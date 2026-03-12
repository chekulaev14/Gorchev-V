/**
 * Тест Блока 2: ProductionOperation + multi-worker.
 * Также проверяет связку с Блоком 1 (Routing production).
 * Запуск: cd app && npx tsx scripts/test-block2-operations.ts
 *
 * Требует: dev server на localhost:3000
 *
 * Блок 2 (домен):
 *   A — один рабочий, без регрессии
 *   B — два рабочих
 *   C — дубль worker → ошибка
 *   D — quantity <= 0 → ошибка
 *   E — идемпотентность clientOperationKey
 *
 * Связка с Блоком 1:
 *   L1 — линейный 1:1, два рабочих
 *   L2 — не-1:1 (3:2), два рабочих
 *   L3 — рекурсия при нехватке, два рабочих
 *   L4 — нет лишней рекурсии, два рабочих
 *
 * Транзакционность:
 *   F — невалидный worker → ничего не создано
 */

import pg from "pg";
import path from "node:path";
import fs from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

// --- DB ---

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

const pool = new pg.Pool({ connectionString: getDatabaseUrl() });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// --- Constants ---

const API = "http://localhost:3000";
const WORKER_PIN = "0000";
const PROCESS_ID = "cutting";
let authCookie = "";

const W1 = "cmmg2ofgb001zeblsctwbru3r"; // Горчев
const W2 = "cmmg2ofgc0020ebls2g4exun7"; // Смирнова

const ITEMS = {
  mat:  { id: "test-b2-mat",  code: "TST2-MAT",  name: "Тест2 Сырьё",   typeId: "material", unitId: "kg"  },
  z1:   { id: "test-b2-z1",   code: "TST2-Z1",   name: "Тест2 З1",      typeId: "blank",    unitId: "pcs" },
  z2:   { id: "test-b2-z2",   code: "TST2-Z2",   name: "Тест2 З2",      typeId: "blank",    unitId: "pcs" },
  prod: { id: "test-b2-prod", code: "TST2-PROD", name: "Тест2 Изделие", typeId: "product",  unitId: "pcs" },
};

const ALL_ITEM_IDS = Object.values(ITEMS).map((i) => i.id);

// --- Helpers ---

let passed = 0;
let total = 0;

async function login() {
  const res = await fetch(`${API}/api/terminal/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin: WORKER_PIN }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) throw new Error("No cookie in login response");
  authCookie = setCookie.split(";")[0];
}

interface ProduceBody {
  itemId: string;
  workers: { workerId: string; quantity: number }[];
  clientOperationKey?: string;
}

async function apiProduce(body: ProduceBody): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const res = await fetch(`${API}/api/terminal/produce`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: authCookie },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, data: JSON.parse(text) };
}

async function getBalance(itemId: string): Promise<number> {
  const rows = await prisma.$queryRaw<{ quantity: number }[]>`
    SELECT quantity FROM stock_balances WHERE item_id = ${itemId} AND location_id = 'MAIN'
  `;
  return rows.length > 0 ? Number(rows[0].quantity) : 0;
}

async function setBalance(itemId: string, qty: number) {
  await prisma.$queryRaw`
    INSERT INTO stock_balances (item_id, location_id, quantity, updated_at)
    VALUES (${itemId}, 'MAIN', ${qty}, NOW())
    ON CONFLICT (item_id, location_id)
    DO UPDATE SET quantity = ${qty}, updated_at = NOW()
  `;
}

async function getProdOp(itemId: string) {
  return prisma.$queryRaw<{ id: string; item_id: string; quantity: number; client_operation_key: string | null }[]>`
    SELECT id, item_id, quantity, client_operation_key
    FROM production_operations WHERE item_id = ${itemId}
    ORDER BY created_at DESC LIMIT 1
  `;
}

async function getProdOpWorkers(prodOpId: string) {
  return prisma.$queryRaw<{ worker_id: string; quantity: number; price_per_unit: number; total: number }[]>`
    SELECT worker_id, quantity, price_per_unit, total
    FROM production_operation_workers WHERE production_operation_id = ${prodOpId}
    ORDER BY worker_id
  `;
}

async function countProdOps(itemId: string): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM production_operations WHERE item_id = ${itemId}
  `;
  return Number(rows[0].count);
}

async function countMovements(itemId: string, type: string): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM stock_movements WHERE item_id = ${itemId} AND type = ${type}
  `;
  return Number(rows[0].count);
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function assertEq(actual: unknown, expected: unknown, label: string) {
  const a = typeof actual === "number" ? Math.round(actual * 10000) / 10000 : actual;
  const e = typeof expected === "number" ? Math.round(expected * 10000) / 10000 : expected;
  if (a !== e) throw new Error(`${label}: ожидалось ${e}, получено ${a}`);
}

// --- Setup / Cleanup ---

async function clearAll() {
  // production_operation_workers
  await prisma.$queryRaw`
    DELETE FROM production_operation_workers
    WHERE production_operation_id IN (SELECT id FROM production_operations WHERE item_id = ANY(${ALL_ITEM_IDS}))
  `;
  // production_operations
  await prisma.$queryRaw`DELETE FROM production_operations WHERE item_id = ANY(${ALL_ITEM_IDS})`;
  // production_logs
  await prisma.$queryRaw`DELETE FROM production_logs WHERE item_id = ANY(${ALL_ITEM_IDS})`;
  // movements + operations
  const ops = await prisma.$queryRaw<{ operation_id: string }[]>`
    SELECT DISTINCT operation_id FROM stock_movements
    WHERE item_id = ANY(${ALL_ITEM_IDS}) AND operation_id IS NOT NULL
  `;
  const opIds = ops.map((o) => o.operation_id);
  await prisma.$queryRaw`DELETE FROM stock_movements WHERE item_id = ANY(${ALL_ITEM_IDS})`;
  if (opIds.length > 0) {
    await prisma.$queryRaw`DELETE FROM inventory_operations WHERE id = ANY(${opIds})`;
  }
  // balances
  await prisma.$queryRaw`DELETE FROM stock_balances WHERE item_id = ANY(${ALL_ITEM_IDS})`;
  // routings
  const rIds = (await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM routings WHERE item_id = ANY(${ALL_ITEM_IDS})`).map((r) => r.id);
  if (rIds.length > 0) {
    await prisma.$queryRaw`DELETE FROM routing_steps WHERE routing_id = ANY(${rIds})`;
    await prisma.$queryRaw`DELETE FROM routings WHERE id = ANY(${rIds})`;
  }
  // items
  await prisma.$queryRaw`DELETE FROM items WHERE id = ANY(${ALL_ITEM_IDS})`;
}

async function setup() {
  console.log("Создание тестовых данных...\n");

  for (const item of Object.values(ITEMS)) {
    await prisma.item.upsert({ where: { id: item.id }, create: item, update: {} });
  }

  // Routing: mat → z1 → z2 (z1 через step1, z2 через step2)
  await createRouting(ITEMS.z2.id, [
    { stepNo: 1, inputItemId: ITEMS.mat.id, outputItemId: ITEMS.z1.id, inputQty: 0.5, outputQty: 1 },
    { stepNo: 2, inputItemId: ITEMS.z1.id,  outputItemId: ITEMS.z2.id, inputQty: 1,   outputQty: 1 },
  ]);

  // Routing: z2 → prod (3:2)
  await createRouting(ITEMS.prod.id, [
    { stepNo: 1, inputItemId: ITEMS.z2.id, outputItemId: ITEMS.prod.id, inputQty: 3, outputQty: 2 },
  ]);
}

async function createRouting(
  itemId: string,
  steps: { stepNo: number; inputItemId: string; outputItemId: string; inputQty: number; outputQty: number }[],
) {
  const existing = await prisma.routing.findMany({ where: { itemId } });
  for (const r of existing) {
    await prisma.routingStep.deleteMany({ where: { routingId: r.id } });
    await prisma.routing.delete({ where: { id: r.id } });
  }
  return prisma.routing.create({
    data: {
      itemId, version: 1, status: "ACTIVE",
      steps: { create: steps.map((s) => ({ ...s, processId: PROCESS_ID })) },
    },
  });
}

async function resetBalances(balances: Record<string, number>) {
  await clearAll();
  await setup();
  for (const [id, qty] of Object.entries(balances)) {
    await setBalance(id, qty);
  }
}

// --- Block 2 Domain Tests ---

async function testA_singleWorker() {
  total++;
  console.log("B2-A: один рабочий, без регрессии");
  await resetBalances({ [ITEMS.mat.id]: 100, [ITEMS.z1.id]: 0 });

  const res = await apiProduce({ itemId: ITEMS.z1.id, workers: [{ workerId: W1, quantity: 10 }] });
  assert(res.ok, `API error: ${JSON.stringify(res.data)}`);

  // ProductionOperation создана
  const ops = await getProdOp(ITEMS.z1.id);
  assertEq(ops.length, 1, "ProductionOperation count");
  assertEq(Number(ops[0].quantity), 10, "operation.quantity");

  // 1 worker
  const workers = await getProdOpWorkers(ops[0].id);
  assertEq(workers.length, 1, "workers count");
  assertEq(workers[0].worker_id, W1, "worker id");
  assertEq(Number(workers[0].quantity), 10, "worker quantity");

  // Balances: mat -= 0.5*10 = 5
  assertEq(await getBalance(ITEMS.mat.id), 95, "mat balance (100 - 0.5*10)");
  assertEq(await getBalance(ITEMS.z1.id), 10, "z1 balance");

  // 1 income movement
  assertEq(await countMovements(ITEMS.z1.id, "ASSEMBLY_INCOME"), 1, "income count");

  console.log("  1 op, 1 worker, mat=95, z1=10  PASS\n");
  passed++;
}

async function testB_twoWorkers() {
  total++;
  console.log("B2-B: два рабочих");
  await resetBalances({ [ITEMS.mat.id]: 100, [ITEMS.z1.id]: 0 });

  const res = await apiProduce({
    itemId: ITEMS.z1.id,
    workers: [{ workerId: W1, quantity: 12 }, { workerId: W2, quantity: 8 }],
  });
  assert(res.ok, `API error: ${JSON.stringify(res.data)}`);

  // 1 ProductionOperation, quantity=20
  const ops = await getProdOp(ITEMS.z1.id);
  assertEq(ops.length, 1, "ProductionOperation count");
  assertEq(Number(ops[0].quantity), 20, "operation.quantity = 20");

  // 2 workers, sum=20
  const workers = await getProdOpWorkers(ops[0].id);
  assertEq(workers.length, 2, "workers count");
  const workerSum = workers.reduce((s, w) => s + Number(w.quantity), 0);
  assertEq(workerSum, 20, "SUM(workers.qty) = 20");

  // Balances: mat -= 0.5*20 = 10, z1 +20
  assertEq(await getBalance(ITEMS.mat.id), 90, "mat balance (100 - 0.5*20)");
  assertEq(await getBalance(ITEMS.z1.id), 20, "z1 balance");

  // 1 income movement (не 2!)
  assertEq(await countMovements(ITEMS.z1.id, "ASSEMBLY_INCOME"), 1, "income count = 1 (не 2)");

  console.log("  1 op, 2 workers (12+8=20), mat=90, 1 movement  PASS\n");
  passed++;
}

async function testC_duplicateWorker() {
  total++;
  console.log("B2-C: дубль worker → ошибка");
  await resetBalances({ [ITEMS.mat.id]: 100, [ITEMS.z1.id]: 0 });

  const res = await apiProduce({
    itemId: ITEMS.z1.id,
    workers: [{ workerId: W1, quantity: 10 }, { workerId: W1, quantity: 5 }],
  });

  assert(!res.ok, "Должна быть ошибка");
  assert(res.status === 400, `Статус должен быть 400, получен ${res.status}`);

  // Ничего не создано
  assertEq(await countProdOps(ITEMS.z1.id), 0, "0 operations");
  assertEq(await getBalance(ITEMS.z1.id), 0, "z1 не изменился");

  console.log("  400 ошибка, 0 операций  PASS\n");
  passed++;
}

async function testD_zeroQuantity() {
  total++;
  console.log("B2-D: quantity <= 0 → ошибка");
  await resetBalances({ [ITEMS.mat.id]: 100, [ITEMS.z1.id]: 0 });

  const res1 = await apiProduce({
    itemId: ITEMS.z1.id,
    workers: [{ workerId: W1, quantity: 0 }],
  });
  assert(!res1.ok, "quantity=0 должна быть ошибка");

  const res2 = await apiProduce({
    itemId: ITEMS.z1.id,
    workers: [{ workerId: W1, quantity: -1 }],
  });
  assert(!res2.ok, "quantity=-1 должна быть ошибка");

  assertEq(await countProdOps(ITEMS.z1.id), 0, "0 operations");

  console.log("  qty=0 и qty=-1 отклонены  PASS\n");
  passed++;
}

async function testE_idempotency() {
  total++;
  console.log("B2-E: идемпотентность clientOperationKey");
  await resetBalances({ [ITEMS.mat.id]: 100, [ITEMS.z1.id]: 0 });

  const key = `test-idem-${Date.now()}`;

  const res1 = await apiProduce({
    itemId: ITEMS.z1.id,
    workers: [{ workerId: W1, quantity: 10 }],
    clientOperationKey: key,
  });
  assert(res1.ok, `1й вызов: ${JSON.stringify(res1.data)}`);

  const res2 = await apiProduce({
    itemId: ITEMS.z1.id,
    workers: [{ workerId: W1, quantity: 10 }],
    clientOperationKey: key,
  });
  assert(res2.ok, `2й вызов: ${JSON.stringify(res2.data)}`);

  // Только 1 операция
  assertEq(await countProdOps(ITEMS.z1.id), 1, "1 operation (не 2)");

  // Только 1 income movement
  assertEq(await countMovements(ITEMS.z1.id, "ASSEMBLY_INCOME"), 1, "1 income (не 2)");

  // Balance = 10 (не 20)
  assertEq(await getBalance(ITEMS.z1.id), 10, "z1=10 (не 20)");

  console.log("  2 вызова, 1 операция, 1 movement  PASS\n");
  passed++;
}

// --- Block 1+2 Linked Tests ---

async function testL1_linear_multiWorker() {
  total++;
  console.log("L1: линейный 1:1 + два рабочих (12+8=20)");
  await resetBalances({ [ITEMS.mat.id]: 100, [ITEMS.z1.id]: 0 });

  const res = await apiProduce({
    itemId: ITEMS.z1.id,
    workers: [{ workerId: W1, quantity: 12 }, { workerId: W2, quantity: 8 }],
  });
  assert(res.ok, `API error: ${JSON.stringify(res.data)}`);

  assertEq(await getBalance(ITEMS.mat.id), 90, "mat=90 (100 - 0.5*20)");
  assertEq(await getBalance(ITEMS.z1.id), 20, "z1=20");

  const ops = await getProdOp(ITEMS.z1.id);
  assertEq(Number(ops[0].quantity), 20, "op.qty=20");

  const workers = await getProdOpWorkers(ops[0].id);
  assertEq(workers.length, 2, "2 workers");

  console.log("  mat=90, z1=20, op=20, workers=12+8  PASS\n");
  passed++;
}

async function testL2_ratio_multiWorker() {
  total++;
  console.log("L2: не-1:1 (3:2) + два рабочих (6+4=10)");
  await resetBalances({ [ITEMS.z2.id]: 15, [ITEMS.prod.id]: 0, [ITEMS.mat.id]: 100 });

  const res = await apiProduce({
    itemId: ITEMS.prod.id,
    workers: [{ workerId: W1, quantity: 6 }, { workerId: W2, quantity: 4 }],
  });
  assert(res.ok, `API error: ${JSON.stringify(res.data)}`);

  // total=10, списание z2 = (3/2)*10 = 15
  assertEq(await getBalance(ITEMS.z2.id), 0, "z2=0 (15-15)");
  assertEq(await getBalance(ITEMS.prod.id), 10, "prod=10");
  assertEq(await getBalance(ITEMS.mat.id), 100, "mat не тронут");

  const ops = await getProdOp(ITEMS.prod.id);
  assertEq(Number(ops[0].quantity), 10, "op.qty=10");
  const workers = await getProdOpWorkers(ops[0].id);
  assertEq(workers.length, 2, "2 workers");

  console.log("  z2=0, prod=10, op=10, workers=6+4  PASS\n");
  passed++;
}

async function testL3_recursion_multiWorker() {
  total++;
  console.log("L3: рекурсия при нехватке + два рабочих (6+4=10)");
  await resetBalances({ [ITEMS.mat.id]: 100, [ITEMS.z1.id]: 0, [ITEMS.z2.id]: 0, [ITEMS.prod.id]: 0 });

  const res = await apiProduce({
    itemId: ITEMS.prod.id,
    workers: [{ workerId: W1, quantity: 6 }, { workerId: W2, quantity: 4 }],
  });
  assert(res.ok, `API error: ${JSON.stringify(res.data)}`);

  // total=10, step 3:2, нужно z2=15
  // z2=0 → рекурсия: нужно z1=15 → рекурсия: mat needed = 0.5*15 = 7.5
  assertEq(await getBalance(ITEMS.mat.id), 92.5, "mat=92.5 (100-7.5)");
  assertEq(await getBalance(ITEMS.z1.id), 0, "z1=0 (приход-списание)");
  assertEq(await getBalance(ITEMS.z2.id), 0, "z2=0 (приход-списание)");
  assertEq(await getBalance(ITEMS.prod.id), 10, "prod=10");

  // 1 ProductionOperation (верхнеуровневая)
  const ops = await getProdOp(ITEMS.prod.id);
  assertEq(Number(ops[0].quantity), 10, "op.qty=10");
  assertEq((await getProdOpWorkers(ops[0].id)).length, 2, "2 workers");

  console.log("  mat=92.5, prod=10, рекурсия сработала  PASS\n");
  passed++;
}

async function testL4_noRecursion_multiWorker() {
  total++;
  console.log("L4: нет лишней рекурсии + два рабочих (6+4=10)");
  await resetBalances({ [ITEMS.mat.id]: 100, [ITEMS.z1.id]: 0, [ITEMS.z2.id]: 20, [ITEMS.prod.id]: 0 });

  const res = await apiProduce({
    itemId: ITEMS.prod.id,
    workers: [{ workerId: W1, quantity: 6 }, { workerId: W2, quantity: 4 }],
  });
  assert(res.ok, `API error: ${JSON.stringify(res.data)}`);

  // total=10, step 3:2, нужно z2=15
  // z2=20 >= 15, НЕ рекурсирует
  assertEq(await getBalance(ITEMS.mat.id), 100, "mat=100 (не тронут)");
  assertEq(await getBalance(ITEMS.z1.id), 0, "z1=0 (не тронут)");
  assertEq(await getBalance(ITEMS.z2.id), 5, "z2=5 (20-15)");
  assertEq(await getBalance(ITEMS.prod.id), 10, "prod=10");

  console.log("  mat=100, z2=5, prod=10, рекурсия НЕ запускалась  PASS\n");
  passed++;
}

// --- Transactional test ---

async function testF_invalidWorker() {
  total++;
  console.log("B2-F: невалидный worker → ничего не создано");
  await resetBalances({ [ITEMS.mat.id]: 100, [ITEMS.z1.id]: 0 });

  const res = await apiProduce({
    itemId: ITEMS.z1.id,
    workers: [{ workerId: W1, quantity: 10 }, { workerId: "nonexistent-worker", quantity: 5 }],
  });

  assert(!res.ok, "Должна быть ошибка");

  // Ничего не создано
  assertEq(await countProdOps(ITEMS.z1.id), 0, "0 operations");
  assertEq(await getBalance(ITEMS.mat.id), 100, "mat не тронут");
  assertEq(await getBalance(ITEMS.z1.id), 0, "z1 не тронут");
  assertEq(await countMovements(ITEMS.z1.id, "ASSEMBLY_INCOME"), 0, "0 movements");

  console.log("  ошибка, 0 операций, 0 movements, балансы чисты  PASS\n");
  passed++;
}

// --- Main ---

async function main() {
  console.log("========================================");
  console.log("  Блок 2: Тесты Operations + Workers");
  console.log("  + связка с Блоком 1 (Routing)");
  console.log("========================================\n");

  try { await fetch(API); } catch {
    console.error("Dev server не запущен на localhost:3000");
    process.exit(1);
  }

  try {
    await login();
    console.log("Авторизация OK\n");
    await clearAll();
    await setup();

    // Блок 2: домен
    console.log("--- Блок 2: доменная модель ---\n");
    await testA_singleWorker();
    await testB_twoWorkers();
    await testC_duplicateWorker();
    await testD_zeroQuantity();
    await testE_idempotency();

    // Блок 2: транзакционность
    console.log("--- Транзакционность ---\n");
    await testF_invalidWorker();

    // Связка с Блоком 1
    console.log("--- Связка с Блоком 1 (Routing) ---\n");
    await testL1_linear_multiWorker();
    await testL2_ratio_multiWorker();
    await testL3_recursion_multiWorker();
    await testL4_noRecursion_multiWorker();

    console.log("========================================");
    console.log(`  ${passed}/${total} сценариев пройдено`);
    console.log("========================================");
  } catch (err) {
    console.error(`\nFAIL: ${(err as Error).message}`);
    console.error(`  ${passed}/${total} passed`);
    process.exit(1);
  } finally {
    await clearAll();
    await prisma.$disconnect();
    pool.end();
  }
}

main();
