/**
 * Seed-скрипт: номенклатура для холодной штамповки
 * Запуск: npx tsx app/scripts/seed-stamping-nomenclature.ts
 *
 * Создаёт: сырьё (5 видов листовой стали), заготовки (8 шт), изделия (6 шт).
 * Без BOM связей — цепочки собираются вручную в конструкторе.
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

const items = [
  // === СЫРЬЁ (листовая сталь, разная толщина) ===
  {
    id: "demo-mat-steel-5mm",
    code: "MAT-D02",
    name: "Лист стальной 5мм",
    typeId: "material",
    unitId: "kg",
    weight: null,
  },
  {
    id: "demo-mat-steel-6mm",
    code: "MAT-D03",
    name: "Лист стальной 6мм",
    typeId: "material",
    unitId: "kg",
    weight: null,
  },
  {
    id: "demo-mat-steel-7mm",
    code: "MAT-D04",
    name: "Лист стальной 7мм",
    typeId: "material",
    unitId: "kg",
    weight: null,
  },
  {
    id: "demo-mat-steel-8mm",
    code: "MAT-D05",
    name: "Лист стальной 8мм",
    typeId: "material",
    unitId: "kg",
    weight: null,
  },
  {
    id: "demo-mat-steel-9mm",
    code: "MAT-D06",
    name: "Лист стальной 9мм",
    typeId: "material",
    unitId: "kg",
    weight: null,
  },

  // === ЗАГОТОВКИ (детали холодной штамповки) ===
  {
    id: "demo-blk-plate-cut",
    code: "BLK-D05",
    name: "Пластина вырубная",
    typeId: "blank",
    unitId: "pcs",
    weight: 1.2,
  },
  {
    id: "demo-blk-sleeve-crimp",
    code: "BLK-D06",
    name: "Втулка обжимная",
    typeId: "blank",
    unitId: "pcs",
    weight: 0.8,
  },
  {
    id: "demo-blk-bracket-bent",
    code: "BLK-D07",
    name: "Скоба гнутая",
    typeId: "blank",
    unitId: "pcs",
    weight: 0.5,
  },
  {
    id: "demo-blk-flange-drawn",
    code: "BLK-D08",
    name: "Фланец вытяжной",
    typeId: "blank",
    unitId: "pcs",
    weight: 2.1,
  },
  {
    id: "demo-blk-shell-cyl",
    code: "BLK-D09",
    name: "Обечайка цилиндрическая",
    typeId: "blank",
    unitId: "pcs",
    weight: 1.8,
  },
  {
    id: "demo-blk-washer-stamp",
    code: "BLK-D10",
    name: "Шайба штампованная",
    typeId: "blank",
    unitId: "pcs",
    weight: 0.3,
  },
  {
    id: "demo-blk-cover-shield",
    code: "BLK-D11",
    name: "Кожух защитный",
    typeId: "blank",
    unitId: "pcs",
    weight: 2.5,
  },
  {
    id: "demo-blk-gusset",
    code: "BLK-D12",
    name: "Косынка усиливающая",
    typeId: "blank",
    unitId: "pcs",
    weight: 0.6,
  },

  // === ИЗДЕЛИЯ ===
  {
    id: "demo-prod-bracket-mount",
    code: "PRD-D03",
    name: "Кронштейн монтажный",
    typeId: "product",
    unitId: "pcs",
    weight: 4.5,
  },
  {
    id: "demo-prod-hinge-ind",
    code: "PRD-D04",
    name: "Петля промышленная",
    typeId: "product",
    unitId: "pcs",
    weight: 2.8,
  },
  {
    id: "demo-prod-support-post",
    code: "PRD-D05",
    name: "Опора стоечная",
    typeId: "product",
    unitId: "pcs",
    weight: 6.2,
  },
  {
    id: "demo-prod-filter-body",
    code: "PRD-D06",
    name: "Корпус фильтра",
    typeId: "product",
    unitId: "pcs",
    weight: 3.4,
  },
  {
    id: "demo-prod-flange-conn",
    code: "PRD-D07",
    name: "Фланец соединительный",
    typeId: "product",
    unitId: "pcs",
    weight: 5.1,
  },
  {
    id: "demo-prod-pipe-holder",
    code: "PRD-D08",
    name: "Держатель трубный",
    typeId: "product",
    unitId: "pcs",
    weight: 1.9,
  },
];

// Приход сырья на склад (неровные количества 100–500 кг)
const materialIncome = [
  { itemId: "demo-mat-steel-5mm", quantity: 157, opKey: "demo-seed-steel-5mm-income" },
  { itemId: "demo-mat-steel-6mm", quantity: 263, opKey: "demo-seed-steel-6mm-income" },
  { itemId: "demo-mat-steel-7mm", quantity: 418, opKey: "demo-seed-steel-7mm-income" },
  { itemId: "demo-mat-steel-8mm", quantity: 192, opKey: "demo-seed-steel-8mm-income" },
  { itemId: "demo-mat-steel-9mm", quantity: 341, opKey: "demo-seed-steel-9mm-income" },
];

const LOCATION = "MAIN";

// --- Seed ---

async function main() {
  console.log("Создаю номенклатуру для холодной штамповки...\n");

  let created = 0;
  let skipped = 0;

  for (const item of items) {
    const existing = await prisma.item.findUnique({ where: { id: item.id } });
    if (existing) {
      console.log(`  ~ ${item.name} [${item.code}] — уже есть, пропускаю`);
      skipped++;
      continue;
    }

    // Проверяем уникальность code
    const codeExists = await prisma.item.findUnique({ where: { code: item.code } });
    if (codeExists) {
      console.log(`  ! ${item.name} — код ${item.code} занят, пропускаю`);
      skipped++;
      continue;
    }

    await prisma.item.create({
      data: {
        id: item.id,
        code: item.code,
        name: item.name,
        typeId: item.typeId,
        unitId: item.unitId,
        side: "NONE",
        weight: item.weight,
        images: [],
      },
    });

    const typeLabel = item.typeId === "material" ? "Сырьё" : item.typeId === "blank" ? "Заготовка" : "Изделие";
    const weightLabel = item.weight ? ` (${item.weight} кг)` : "";
    console.log(`  + [${typeLabel}] ${item.name}${weightLabel} [${item.code}]`);
    created++;
  }

  console.log(`\nНоменклатура: создано ${created}, пропущено ${skipped}`);

  // Приход сырья
  console.log("\nПриход сырья на склад...");
  for (const inc of materialIncome) {
    const existingOp = await prisma.inventoryOperation.findUnique({
      where: { operationKey: inc.opKey },
    });

    if (existingOp) {
      console.log(`  ~ ${inc.itemId} — приход уже есть, пропускаю`);
      continue;
    }

    const operation = await prisma.inventoryOperation.create({
      data: { operationKey: inc.opKey, type: "SUPPLIER_RECEIPT" },
    });

    await prisma.stockMovement.create({
      data: {
        type: "SUPPLIER_INCOME",
        itemId: inc.itemId,
        quantity: inc.quantity,
        operationId: operation.id,
        fromLocationId: "EXTERNAL",
        toLocationId: LOCATION,
        comment: "Начальный приход — демо seed штамповка",
      },
    });

    await prisma.$queryRaw`
      INSERT INTO stock_balances (item_id, location_id, quantity, updated_at)
      VALUES (${inc.itemId}, ${LOCATION}, ${inc.quantity}::numeric, NOW())
      ON CONFLICT (item_id, location_id)
      DO UPDATE SET quantity = ${inc.quantity}::numeric, updated_at = NOW()
    `;

    const itemName = items.find((i) => i.id === inc.itemId)!.name;
    console.log(`  + ${inc.quantity} кг ${itemName} → MAIN`);
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
