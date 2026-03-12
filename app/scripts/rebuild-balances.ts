/**
 * Утилита пересчёта StockBalance из StockMovement.
 *
 * Режимы:
 *   rebuild   — truncate stock_balances, полный пересчёт
 *   reconcile — сверка без изменений, показ расхождений
 *
 * Баланс по location:
 *   balance(item, location) = SUM(quantity WHERE to=location) - SUM(quantity WHERE from=location)
 *   quantity всегда > 0, from/to определяет направление.
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

interface BalanceRow {
  item_id: string;
  location_id: string;
  computed: number;
}

const pool = new pg.Pool({ connectionString: getDatabaseUrl() });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/**
 * Пересчёт балансов через from/to location.
 * Для каждого (item, location):
 *   income = SUM(quantity) WHERE to_location_id = location
 *   expense = SUM(quantity) WHERE from_location_id = location
 *   balance = income - expense
 */
async function computeBalances(): Promise<BalanceRow[]> {
  return prisma.$queryRaw<BalanceRow[]>`
    SELECT item_id, location_id, SUM(qty)::numeric AS computed
    FROM (
      SELECT item_id, to_location_id AS location_id, quantity AS qty
      FROM stock_movements
      UNION ALL
      SELECT item_id, from_location_id AS location_id, -quantity AS qty
      FROM stock_movements
    ) movements
    GROUP BY item_id, location_id
    HAVING SUM(qty) != 0
  `;
}

async function rebuild() {
  console.log("=== REBUILD: пересчёт StockBalance ===\n");

  const rows = await computeBalances();
  console.log(`Найдено ${rows.length} пар (item, location) с ненулевым балансом.`);

  await prisma.$queryRaw`TRUNCATE stock_balances`;
  console.log("stock_balances очищена.");

  let inserted = 0;
  for (const row of rows) {
    const qty = Number(row.computed);
    if (qty === 0) continue;
    await prisma.$queryRaw`
      INSERT INTO stock_balances (item_id, location_id, quantity, updated_at)
      VALUES (${row.item_id}, ${row.location_id}, ${qty}, NOW())
    `;
    inserted++;
  }

  console.log(`Вставлено ${inserted} записей в stock_balances.`);
  console.log("Rebuild завершён.");
}

async function reconcile() {
  console.log("=== RECONCILE: сверка StockBalance ===\n");

  const computed = await computeBalances();
  const currentRows = await prisma.$queryRaw<{ item_id: string; location_id: string; quantity: number }[]>`
    SELECT item_id, location_id, quantity FROM stock_balances
  `;

  const currentMap: Record<string, number> = {};
  for (const row of currentRows) currentMap[`${row.item_id}:${row.location_id}`] = Number(row.quantity);

  const computedMap: Record<string, number> = {};
  for (const row of computed) computedMap[`${row.item_id}:${row.location_id}`] = Number(row.computed);

  const allKeys = new Set([...Object.keys(currentMap), ...Object.keys(computedMap)]);
  const diffs: { key: string; current: number; computed: number; delta: number }[] = [];

  for (const key of allKeys) {
    const current = currentMap[key] ?? 0;
    const comp = computedMap[key] ?? 0;
    const delta = Math.round((comp - current) * 10000) / 10000;
    if (delta !== 0) {
      diffs.push({ key, current, computed: comp, delta });
    }
  }

  if (diffs.length === 0) {
    console.log("Расхождений нет. StockBalance актуален.");
  } else {
    console.log(`Найдено ${diffs.length} расхождений:\n`);
    console.log("item:location | current | computed | delta");
    console.log("-------------|---------|----------|------");
    for (const d of diffs) {
      console.log(`${d.key} | ${d.current} | ${d.computed} | ${d.delta > 0 ? "+" : ""}${d.delta}`);
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
