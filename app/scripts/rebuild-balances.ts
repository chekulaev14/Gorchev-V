/**
 * Утилита пересчёта StockBalance из StockMovement.
 *
 * Режимы:
 *   rebuild   — truncate stock_balances, полный пересчёт
 *   reconcile — сверка без изменений, показ расхождений
 *
 * Запуск: npx tsx scripts/rebuild-balances.ts rebuild|reconcile
 */

import pg from "pg";
import path from "node:path";
import fs from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

function getDatabaseUrl(): string {
  if (process.env["DATABASE_URL"]) return process.env["DATABASE_URL"];
  if (process.env["ERP_DATABASE_URL"]) return process.env["ERP_DATABASE_URL"];
  const globalEnvPath = path.join(process.env["HOME"] || "", ".env.global");
  if (fs.existsSync(globalEnvPath)) {
    const content = fs.readFileSync(globalEnvPath, "utf-8");
    const match = content.match(/^ERP_DATABASE_URL=(.+)$/m);
    if (match) return match[1].trim();
  }
  throw new Error("DATABASE_URL not found");
}

const INCOME_TYPES = [
  "SUPPLIER_INCOME",
  "PRODUCTION_INCOME",
  "ASSEMBLY_INCOME",
  "ADJUSTMENT_INCOME",
];

const DEFAULT_LOCATION = "MAIN";

interface BalanceRow {
  item_id: string;
  computed: number;
}

const pool = new pg.Pool({ connectionString: getDatabaseUrl() });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function computeBalances(): Promise<BalanceRow[]> {
  return prisma.$queryRaw<BalanceRow[]>`
    SELECT item_id,
      COALESCE(SUM(
        CASE WHEN type = ANY(${INCOME_TYPES}) THEN quantity ELSE -quantity END
      ), 0)::numeric AS computed
    FROM stock_movements
    GROUP BY item_id
  `;
}

async function rebuild() {
  console.log("=== REBUILD: пересчёт StockBalance ===\n");

  const rows = await computeBalances();
  console.log(`Найдено ${rows.length} позиций с движениями.`);

  await prisma.$queryRaw`TRUNCATE stock_balances`;
  console.log("stock_balances очищена.");

  let inserted = 0;
  for (const row of rows) {
    const qty = Number(row.computed);
    if (qty === 0) continue;
    await prisma.$queryRaw`
      INSERT INTO stock_balances (item_id, location_id, quantity, updated_at)
      VALUES (${row.item_id}, ${DEFAULT_LOCATION}, ${qty}, NOW())
    `;
    inserted++;
  }

  console.log(`Вставлено ${inserted} записей в stock_balances.`);
  console.log("Rebuild завершён.");
}

async function reconcile() {
  console.log("=== RECONCILE: сверка StockBalance ===\n");

  const computed = await computeBalances();
  const currentRows = await prisma.$queryRaw<{ item_id: string; quantity: number }[]>`
    SELECT item_id, quantity FROM stock_balances WHERE location_id = ${DEFAULT_LOCATION}
  `;

  const currentMap: Record<string, number> = {};
  for (const row of currentRows) currentMap[row.item_id] = Number(row.quantity);

  const computedMap: Record<string, number> = {};
  for (const row of computed) computedMap[row.item_id] = Number(row.computed);

  const allIds = new Set([...Object.keys(currentMap), ...Object.keys(computedMap)]);
  const diffs: { itemId: string; current: number; computed: number; delta: number }[] = [];

  for (const id of allIds) {
    const current = currentMap[id] ?? 0;
    const comp = computedMap[id] ?? 0;
    const delta = Math.round((comp - current) * 10000) / 10000;
    if (delta !== 0) {
      diffs.push({ itemId: id, current, computed: comp, delta });
    }
  }

  if (diffs.length === 0) {
    console.log("Расхождений нет. StockBalance актуален.");
  } else {
    console.log(`Найдено ${diffs.length} расхождений:\n`);
    console.log("item_id | current | computed | delta");
    console.log("--------|---------|----------|------");
    for (const d of diffs) {
      console.log(`${d.itemId} | ${d.current} | ${d.computed} | ${d.delta > 0 ? "+" : ""}${d.delta}`);
    }
    console.log("\nДля исправления запустите: npx tsx scripts/rebuild-balances.ts rebuild");
  }
}

const mode = process.argv[2];
if (mode !== "rebuild" && mode !== "reconcile") {
  console.log("Использование: npx tsx scripts/rebuild-balances.ts rebuild|reconcile");
  process.exit(1);
}

(mode === "rebuild" ? rebuild() : reconcile())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
