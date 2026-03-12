/**
 * Seed-скрипт: демо-номенклатура кронштейнов
 * Запуск: npx tsx app/scripts/seed-demo-parts.ts
 *
 * Создаёт: сырьё, детали (парные и непарные), изделия (парные),
 * BOM цепочку, приход 500 кг листа стального.
 * Идемпотентный — можно запускать повторно.
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
  throw new Error("DATABASE_URL not found. Set ERP_DATABASE_URL in ~/.env.global");
}

const connectionString = getDatabaseUrl();
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// --- Данные ---

const IMG = "/images/parts";

const items = [
  {
    id: "demo-mat-steel-4mm",
    code: "MAT-D01",
    name: "Лист стальной 4мм",
    typeId: "material",
    unitId: "kg",
    side: "NONE" as const,
    weight: null,
    images: [] as string[],
  },
  {
    id: "demo-blk-hook-plate",
    code: "BLK-D01",
    name: "Пластина крюка",
    typeId: "blank",
    unitId: "pcs",
    side: "NONE" as const,
    weight: 3,
    images: [`${IMG}/plastina-kruka.jpeg`],
  },
  {
    id: "demo-blk-hook-plate-perf",
    code: "BLK-D02",
    name: "Пластина крюка перфорированная",
    typeId: "blank",
    unitId: "pcs",
    side: "NONE" as const,
    weight: 3,
    images: [`${IMG}/plastina-perf.jpeg`],
  },
  {
    id: "demo-blk-hook-bent-l",
    code: "BLK-D03",
    name: "Крюк гнутый Л",
    typeId: "blank",
    unitId: "pcs",
    side: "LEFT" as const,
    weight: 3,
    images: [`${IMG}/kruk-gnuty.jpeg`],
  },
  {
    id: "demo-blk-hook-bent-r",
    code: "BLK-D04",
    name: "Крюк гнутый П",
    typeId: "blank",
    unitId: "pcs",
    side: "RIGHT" as const,
    baseItemId: "demo-blk-hook-bent-l",
    weight: 3,
    images: [`${IMG}/kruk-gnuty.jpeg`],
  },
  {
    id: "demo-prod-bracket-l",
    code: "PRD-D01",
    name: "Кронштейн Л",
    typeId: "product",
    unitId: "pcs",
    side: "LEFT" as const,
    weight: 3,
    images: [`${IMG}/kronshtein.jpeg`],
  },
  {
    id: "demo-prod-bracket-r",
    code: "PRD-D02",
    name: "Кронштейн П",
    typeId: "product",
    unitId: "pcs",
    side: "RIGHT" as const,
    baseItemId: "demo-prod-bracket-l",
    weight: 3,
    images: [`${IMG}/kronshtein.jpeg`],
  },
];

const bomEntries = [
  { parentId: "demo-blk-hook-plate", childId: "demo-mat-steel-4mm", quantity: 3 },
  { parentId: "demo-blk-hook-plate-perf", childId: "demo-blk-hook-plate", quantity: 1 },
  { parentId: "demo-blk-hook-bent-l", childId: "demo-blk-hook-plate-perf", quantity: 1 },
  { parentId: "demo-blk-hook-bent-r", childId: "demo-blk-hook-plate-perf", quantity: 1 },
  { parentId: "demo-prod-bracket-l", childId: "demo-blk-hook-bent-l", quantity: 1 },
  { parentId: "demo-prod-bracket-r", childId: "demo-blk-hook-bent-r", quantity: 1 },
];

const INCOME_OP_KEY = "demo-seed-steel-income";
const LOCATION = "MAIN";

// --- Seed ---

async function main() {
  console.log("Создаю номенклатуру...");

  for (const item of items) {
    await prisma.item.upsert({
      where: { id: item.id },
      update: {
        name: item.name,
        images: item.images,
        weight: item.weight,
        side: item.side,
        baseItemId: "baseItemId" in item ? item.baseItemId : null,
      },
      create: {
        id: item.id,
        code: item.code,
        name: item.name,
        typeId: item.typeId,
        unitId: item.unitId,
        side: item.side,
        baseItemId: "baseItemId" in item ? item.baseItemId : null,
        weight: item.weight,
        images: item.images,
      },
    });
    const sideLabel = item.side !== "NONE" ? ` (${item.side === "LEFT" ? "Л" : "П"})` : "";
    console.log(`  + ${item.name}${sideLabel} [${item.code}]`);
  }

  console.log("\nСоздаю BOM связи...");
  for (const bom of bomEntries) {
    await prisma.bomEntry.upsert({
      where: { parentId_childId: { parentId: bom.parentId, childId: bom.childId } },
      update: { quantity: bom.quantity },
      create: { parentId: bom.parentId, childId: bom.childId, quantity: bom.quantity },
    });
    const parent = items.find((i) => i.id === bom.parentId)!;
    const child = items.find((i) => i.id === bom.childId)!;
    console.log(`  ${parent.name} ← ${child.name} x${bom.quantity}`);
  }

  // Приход 500 кг листа стального
  console.log("\nПриход на склад...");
  const existingOp = await prisma.inventoryOperation.findUnique({
    where: { operationKey: INCOME_OP_KEY },
  });

  if (existingOp) {
    console.log("  Приход уже существует, пропускаю.");
  } else {
    const operation = await prisma.inventoryOperation.create({
      data: { operationKey: INCOME_OP_KEY, type: "SUPPLIER_RECEIPT" },
    });

    await prisma.stockMovement.create({
      data: {
        type: "SUPPLIER_INCOME",
        itemId: "demo-mat-steel-4mm",
        quantity: 500,
        operationId: operation.id,
        fromLocationId: "EXTERNAL",
        toLocationId: LOCATION,
        comment: "Начальный приход — демо seed",
      },
    });

    // Upsert StockBalance
    await prisma.$queryRaw`
      INSERT INTO stock_balances (item_id, location_id, quantity, updated_at)
      VALUES (${"demo-mat-steel-4mm"}, ${LOCATION}, 500, NOW())
      ON CONFLICT (item_id, location_id)
      DO UPDATE SET quantity = 500, updated_at = NOW()
    `;

    console.log("  + 500 кг Лист стальной 4мм → MAIN");
  }

  console.log("\nГотово!");
}

main()
  .catch((e) => {
    console.error("Ошибка:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
