/**
 * Seed: реалистичная номенклатура для холодной штамповки.
 * Многоуровневые цепочки: Сырьё → Заготовки уровня 1 → Заготовки уровня 2 → Изделия
 * Запуск: npx tsx scripts/seed-nomenclature.ts
 */
import { prisma } from "../src/lib/prisma";

// --- Helpers ---

async function getNextCode(tx: typeof prisma, kind: string): Promise<string> {
  const prefixes: Record<string, string> = { MATERIAL: "MAT", BLANK: "BLK", PRODUCT: "PRD" };
  const prefix = prefixes[kind] || "ITM";
  const counter = await tx.codeCounter.upsert({
    where: { key: kind },
    update: { value: { increment: 1 } },
    create: { key: kind, value: 1 },
  });
  return `${prefix}-${String(counter.value).padStart(4, "0")}`;
}

interface RawItem {
  name: string;
  typeId: "material" | "blank" | "product";
  unitId: "kg" | "pcs";
  weight?: number;
  pricePerUnit?: number;
}

async function createItem(tx: typeof prisma, raw: RawItem) {
  const kindMap: Record<string, string> = { material: "MATERIAL", blank: "BLANK", product: "PRODUCT" };
  const code = await getNextCode(tx, kindMap[raw.typeId]);
  return tx.item.create({
    data: {
      id: crypto.randomUUID(),
      code,
      name: raw.name,
      typeId: raw.typeId,
      unitId: raw.unitId,
      images: [],
      weight: raw.weight ?? null,
      pricePerUnit: raw.pricePerUnit ?? null,
    },
  });
}

async function addStock(tx: typeof prisma, itemId: string, quantity: number) {
  const opKey = `seed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const op = await tx.inventoryOperation.create({
    data: { operationKey: opKey, type: "SUPPLIER_RECEIPT" },
  });
  await tx.stockMovement.create({
    data: {
      type: "SUPPLIER_INCOME",
      itemId,
      quantity,
      toLocationId: "MAIN",
      operationId: op.id,
    },
  });
  await tx.stockBalance.upsert({
    where: { itemId_locationId: { itemId, locationId: "MAIN" } },
    update: { quantity: { increment: quantity } },
    create: { itemId, locationId: "MAIN", quantity },
  });
}

async function addBom(tx: typeof prisma, parentId: string, childId: string, quantity: number) {
  await tx.bomEntry.create({
    data: { parentId, childId, quantity },
  });
}

// --- Data ---

// ========================
// СЫРЬЁ (6 позиций)
// ========================
const materials: (RawItem & { stock: number })[] = [
  { name: "Лист стали 2мм", typeId: "material", unitId: "kg", stock: 850 },   // [0]
  { name: "Лист стали 3мм", typeId: "material", unitId: "kg", stock: 720 },   // [1]
  { name: "Лист стали 4мм", typeId: "material", unitId: "kg", stock: 640 },   // [2]
  { name: "Лист стали 5мм", typeId: "material", unitId: "kg", stock: 510 },   // [3]
  { name: "Лист стали 6мм", typeId: "material", unitId: "kg", stock: 930 },   // [4]
  { name: "Лист стали 7мм", typeId: "material", unitId: "kg", stock: 580 },   // [5]
];

// ========================
// ЗАГОТОВКИ УРОВНЯ 1 — вырубка/резка из листа (из сырья)
// BOM: заготовка → лист стали, quantity = вес заготовки
// ========================
interface BlankL1 { name: string; matIdx: number; weight: number; price: number }
const blanksL1: BlankL1[] = [
  // Из 2мм
  { name: "Полоса 200×30×2",        matIdx: 0, weight: 0.094, price: 5 },   // [0]
  { name: "Полоса 300×40×2",        matIdx: 0, weight: 0.188, price: 6 },   // [1]
  { name: "Пластина 120×60×2",      matIdx: 0, weight: 0.113, price: 6 },   // [2]
  { name: "Пластина 80×40×2",       matIdx: 0, weight: 0.050, price: 4 },   // [3]
  { name: "Круг D50×2",             matIdx: 0, weight: 0.031, price: 4 },   // [4]
  // Из 3мм
  { name: "Полоса 250×40×3",        matIdx: 1, weight: 0.236, price: 7 },   // [5]
  { name: "Полоса 300×50×3",        matIdx: 1, weight: 0.353, price: 8 },   // [6]
  { name: "Пластина 150×80×3",      matIdx: 1, weight: 0.283, price: 8 },   // [7]
  { name: "Пластина 100×50×3",      matIdx: 1, weight: 0.118, price: 6 },   // [8]
  { name: "Круг D60×3",             matIdx: 1, weight: 0.066, price: 5 },   // [9]
  // Из 4мм
  { name: "Полоса 200×60×4",        matIdx: 2, weight: 0.377, price: 9 },   // [10]
  { name: "Пластина 120×80×4",      matIdx: 2, weight: 0.301, price: 9 },   // [11]
  { name: "Пластина 100×100×4",     matIdx: 2, weight: 0.314, price: 10 },  // [12]
  { name: "Круг D80×4",             matIdx: 2, weight: 0.158, price: 7 },   // [13]
  // Из 5мм
  { name: "Полоса 250×60×5",        matIdx: 3, weight: 0.589, price: 12 },  // [14]
  { name: "Пластина 150×100×5",     matIdx: 3, weight: 0.589, price: 12 },  // [15]
  { name: "Пластина 120×120×5",     matIdx: 3, weight: 0.565, price: 12 },  // [16]
  { name: "Круг D100×5",            matIdx: 3, weight: 0.308, price: 10 },  // [17]
  // Из 6мм
  { name: "Полоса 300×80×6",        matIdx: 4, weight: 1.130, price: 16 },  // [18]
  { name: "Пластина 200×150×6",     matIdx: 4, weight: 1.413, price: 18 },  // [19]
  { name: "Пластина 160×100×6",     matIdx: 4, weight: 0.753, price: 14 },  // [20]
  { name: "Круг D120×6",            matIdx: 4, weight: 0.533, price: 12 },  // [21]
  // Из 7мм
  { name: "Полоса 350×100×7",       matIdx: 5, weight: 1.923, price: 22 },  // [22]
  { name: "Пластина 250×200×7",     matIdx: 5, weight: 2.747, price: 26 },  // [23]
  { name: "Пластина 200×120×7",     matIdx: 5, weight: 1.319, price: 20 },  // [24]
  { name: "Пластина 180×180×7",     matIdx: 5, weight: 1.781, price: 22 },  // [25]
];

// ========================
// ЗАГОТОВКИ УРОВНЯ 2 — штамповка/гибка из заготовок уровня 1
// BOM: заготовка L2 → заготовка L1, quantity = 1 (1 полоса = 1 деталь)
// ========================
interface BlankL2 { name: string; parentL1Idx: number; qty: number; weight: number; price: number }
const blanksL2: BlankL2[] = [
  // Из полос/пластин 2мм
  { name: "Скоба крепёжная 2мм",       parentL1Idx: 0, qty: 1, weight: 0.085, price: 8 },    // [0]
  { name: "Шайба D30×2",               parentL1Idx: 4, qty: 1, weight: 0.011, price: 4 },    // [1]
  { name: "Кольцо D40×2",              parentL1Idx: 4, qty: 1, weight: 0.015, price: 5 },    // [2]
  { name: "Накладка тонкая 100×50×2",   parentL1Idx: 2, qty: 1, weight: 0.078, price: 9 },   // [3]
  // Из полос/пластин 3мм
  { name: "Скоба усиленная 3мм",       parentL1Idx: 5, qty: 1, weight: 0.200, price: 11 },   // [4]
  { name: "Фланец D60×3",              parentL1Idx: 9, qty: 1, weight: 0.060, price: 10 },   // [5]
  { name: "Накладка 80×60×3",          parentL1Idx: 8, qty: 1, weight: 0.105, price: 10 },   // [6]
  { name: "Шайба D50×3",               parentL1Idx: 9, qty: 1, weight: 0.046, price: 6 },    // [7]
  // Из полос/пластин 4мм
  { name: "Косынка 100×100×4",         parentL1Idx: 12, qty: 1, weight: 0.290, price: 15 },  // [8]
  { name: "Фланец D80×4",              parentL1Idx: 13, qty: 1, weight: 0.145, price: 14 },  // [9]
  { name: "Ребро жёсткости 150×50×4",  parentL1Idx: 10, qty: 1, weight: 0.220, price: 12 },  // [10]
  { name: "Накладка 100×60×4",         parentL1Idx: 11, qty: 1, weight: 0.175, price: 13 },  // [11]
  { name: "Планка опорная 200×40×4",   parentL1Idx: 10, qty: 1, weight: 0.240, price: 14 },  // [12]
  // Из полос/пластин 5мм
  { name: "Косынка 80×80×5",           parentL1Idx: 15, qty: 1, weight: 0.240, price: 16 },  // [13]
  { name: "Фланец D100×5",             parentL1Idx: 17, qty: 1, weight: 0.290, price: 18 },  // [14]
  { name: "Упор 60×60×5",              parentL1Idx: 14, qty: 1, weight: 0.135, price: 14 },  // [15]
  { name: "Планка 180×50×5",           parentL1Idx: 14, qty: 1, weight: 0.340, price: 16 },  // [16]
  // Из полос/пластин 6мм
  { name: "Косынка 120×120×6",         parentL1Idx: 20, qty: 1, weight: 0.650, price: 20 },  // [17]
  { name: "Фланец D120×6",             parentL1Idx: 21, qty: 1, weight: 0.500, price: 24 },  // [18]
  { name: "Ребро 200×60×6",            parentL1Idx: 18, qty: 1, weight: 0.530, price: 18 },  // [19]
  { name: "Опора 100×100×6",           parentL1Idx: 20, qty: 1, weight: 0.440, price: 20 },  // [20]
  // Из полос/пластин 7мм
  { name: "Косынка 150×150×7",         parentL1Idx: 24, qty: 1, weight: 1.180, price: 28 },  // [21]
  { name: "Фланец D150×7",             parentL1Idx: 22, qty: 1, weight: 0.920, price: 30 },  // [22]
  { name: "Ребро жёсткости 250×80×7",  parentL1Idx: 22, qty: 1, weight: 1.050, price: 24 },  // [23]
  { name: "Накладка усиленная 160×100×7", parentL1Idx: 24, qty: 1, weight: 0.840, price: 26 }, // [24]
];

// ========================
// ИЗДЕЛИЯ (12 позиций)
// Компоненты — заготовки L1 и L2 вперемешку
// ========================
interface ProductDef {
  name: string;
  components: { type: "L1" | "L2"; idx: number; qty: number }[];
  price: number;
}

const products: ProductDef[] = [
  {
    // Кронштейн: 2 пластины 3мм (L1) + 1 косынка 4мм (L2)
    name: "Кронштейн стеновой КС-1",
    components: [{ type: "L1", idx: 8, qty: 2 }, { type: "L2", idx: 8, qty: 1 }],
    price: 85,
  },
  {
    // Кронштейн: 2 пластины 3мм (L1) + 1 накладка 4мм (L2) + 2 скобы 2мм (L2)
    name: "Кронштейн стеновой КС-2",
    components: [{ type: "L1", idx: 7, qty: 2 }, { type: "L2", idx: 11, qty: 1 }, { type: "L2", idx: 0, qty: 2 }],
    price: 110,
  },
  {
    // Петля: 2 пластины 2мм (L1) + 4 шайбы 2мм (L2)
    name: "Петля дверная ПД-80",
    components: [{ type: "L1", idx: 2, qty: 2 }, { type: "L2", idx: 1, qty: 4 }],
    price: 65,
  },
  {
    // Уголок: 2 фланца 3мм (L2) + 2 кольца 2мм (L2)
    name: "Уголок монтажный УМ-50",
    components: [{ type: "L2", idx: 5, qty: 2 }, { type: "L2", idx: 2, qty: 2 }],
    price: 55,
  },
  {
    // Опора: 1 основание 5мм (L1) + 2 упора 5мм (L2) + 1 фланец 5мм (L2)
    name: "Опора регулируемая ОР-1",
    components: [{ type: "L1", idx: 16, qty: 1 }, { type: "L2", idx: 15, qty: 2 }, { type: "L2", idx: 14, qty: 1 }],
    price: 140,
  },
  {
    // Фиксатор: 2 пластины 4мм (L1) + 2 ребра 4мм (L2) + 1 фланец 4мм (L2)
    name: "Фиксатор балочный ФБ-120",
    components: [{ type: "L1", idx: 11, qty: 2 }, { type: "L2", idx: 10, qty: 2 }, { type: "L2", idx: 9, qty: 1 }],
    price: 160,
  },
  {
    // Пластина крепёжная: 1 пластина 5мм (L1) + 2 косынки 5мм (L2)
    name: "Пластина крепёжная ПК-200",
    components: [{ type: "L1", idx: 15, qty: 1 }, { type: "L2", idx: 13, qty: 2 }],
    price: 95,
  },
  {
    // Основание: 1 основание 6мм (L1) + 2 косынки 6мм (L2) + 4 ребра 6мм (L2)
    name: "Основание станочное ОС-1",
    components: [{ type: "L1", idx: 19, qty: 1 }, { type: "L2", idx: 17, qty: 2 }, { type: "L2", idx: 19, qty: 4 }],
    price: 280,
  },
  {
    // Рама: 1 основание 7мм (L1) + 2 фланца 7мм (L2) + 2 ребра 7мм (L2)
    name: "Рама сварная РС-250",
    components: [{ type: "L1", idx: 23, qty: 1 }, { type: "L2", idx: 22, qty: 2 }, { type: "L2", idx: 23, qty: 2 }],
    price: 320,
  },
  {
    // Корпус: 2 пластины 6мм (L1) + 1 фланец 6мм (L2) + 2 накладки 7мм (L2)
    name: "Корпус защитный КЗ-150",
    components: [{ type: "L1", idx: 20, qty: 2 }, { type: "L2", idx: 18, qty: 1 }, { type: "L2", idx: 24, qty: 2 }],
    price: 240,
  },
  {
    // Крышка: 1 накладка 3мм (L2) + 4 скобы 3мм (L2) + 4 шайбы 3мм (L2)
    name: "Крышка ревизионная КР-1",
    components: [{ type: "L2", idx: 6, qty: 1 }, { type: "L2", idx: 4, qty: 4 }, { type: "L2", idx: 7, qty: 4 }],
    price: 95,
  },
  {
    // Консоль: 1 плита 7мм (L1) + 2 косынки 7мм (L2) + 2 опоры 6мм (L2)
    name: "Консоль несущая КН-2",
    components: [{ type: "L1", idx: 25, qty: 1 }, { type: "L2", idx: 21, qty: 2 }, { type: "L2", idx: 20, qty: 2 }],
    price: 260,
  },
];

// --- Main ---

async function main() {
  console.log("Seeding nomenclature (multi-level chains)...\n");

  // 1. Сырьё
  console.log("=== СЫРЬЁ ===");
  const matIds: string[] = [];
  for (const mat of materials) {
    const item = await createItem(prisma, mat);
    await addStock(prisma, item.id, mat.stock);
    matIds.push(item.id);
    console.log(`  ${item.code} ${mat.name} — ${mat.stock} кг`);
  }

  // 2. Заготовки уровня 1 (из сырья)
  console.log("\n=== ЗАГОТОВКИ L1 (из сырья) ===");
  const l1Ids: string[] = [];
  for (const b of blanksL1) {
    const item = await createItem(prisma, {
      name: b.name,
      typeId: "blank",
      unitId: "pcs",
      weight: b.weight,
      pricePerUnit: b.price,
    });
    await addBom(prisma, item.id, matIds[b.matIdx], b.weight);
    l1Ids.push(item.id);
    console.log(`  ${item.code} ${b.name} (${b.weight} кг) ← ${materials[b.matIdx].name}`);
  }

  // 3. Заготовки уровня 2 (из заготовок L1)
  console.log("\n=== ЗАГОТОВКИ L2 (из заготовок L1) ===");
  const l2Ids: string[] = [];
  for (const b of blanksL2) {
    const item = await createItem(prisma, {
      name: b.name,
      typeId: "blank",
      unitId: "pcs",
      weight: b.weight,
      pricePerUnit: b.price,
    });
    await addBom(prisma, item.id, l1Ids[b.parentL1Idx], b.qty);
    l2Ids.push(item.id);
    console.log(`  ${item.code} ${b.name} (${b.weight} кг) ← ${blanksL1[b.parentL1Idx].name}`);
  }

  // 4. Изделия
  console.log("\n=== ИЗДЕЛИЯ ===");
  for (const p of products) {
    const item = await createItem(prisma, {
      name: p.name,
      typeId: "product",
      unitId: "pcs",
      pricePerUnit: p.price,
    });
    const parts: string[] = [];
    for (const comp of p.components) {
      const compId = comp.type === "L1" ? l1Ids[comp.idx] : l2Ids[comp.idx];
      const compName = comp.type === "L1" ? blanksL1[comp.idx].name : blanksL2[comp.idx].name;
      await addBom(prisma, item.id, compId, comp.qty);
      parts.push(`${compName} ×${comp.qty}`);
    }
    console.log(`  ${item.code} ${p.name} ← [${parts.join(", ")}]`);
  }

  console.log(`\nDone! Created: ${materials.length} materials, ${blanksL1.length} L1 blanks, ${blanksL2.length} L2 blanks, ${products.length} products`);
  console.log(`Total: ${materials.length + blanksL1.length + blanksL2.length + products.length} items`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
