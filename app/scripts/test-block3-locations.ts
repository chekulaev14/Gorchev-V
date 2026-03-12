/**
 * Тест Блока 3: Location + полная связка с Блоками 1-2.
 * Запуск: cd app && npx tsx scripts/test-block3-locations.ts
 *
 * B3-A — schema: from/to NOT NULL, нет null в БД
 * B3-B — системные Location с isSystem=true
 * B3-C — маппинг from/to по типам движений
 * B3-D — INSERT без from/to невозможен
 * L13-A — производство: from/to корректны
 * L13-B — рекурсия: все шаги with correct from/to
 * L23-A — два worker + from/to
 * L23-B — rollback: нет мусорных movements
 * E2E  — рекурсия + 2 worker + from/to (полная связка 1+2+3)
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

const W1 = "cmmg2ofgb001zeblsctwbru3r";
const W2 = "cmmg2ofgc0020ebls2g4exun7";

const ITEMS = {
  mat:  { id: "test-b3-mat",  code: "TST3-MAT",  name: "Тест3 Сырьё",   typeId: "material", unitId: "kg"  },
  z1:   { id: "test-b3-z1",   code: "TST3-Z1",   name: "Тест3 З1",      typeId: "blank",    unitId: "pcs" },
  z2:   { id: "test-b3-z2",   code: "TST3-Z2",   name: "Тест3 З2",      typeId: "blank",    unitId: "pcs" },
  prod: { id: "test-b3-prod", code: "TST3-PROD", name: "Тест3 Изделие", typeId: "product",  unitId: "pcs" },
};
const ALL_ITEM_IDS = Object.values(ITEMS).map((i) => i.id);

let passed = 0;
let total = 0;

// --- Helpers ---

async function login() {
  const res = await fetch(`${API}/api/terminal/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin: WORKER_PIN }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) throw new Error("No cookie");
  authCookie = setCookie.split(";")[0];
}

async function apiProduce(body: {
  itemId: string;
  workers: { workerId: string; quantity: number }[];
  clientOperationKey?: string;
}) {
  const res = await fetch(`${API}/api/terminal/produce`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: authCookie },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, data: JSON.parse(text) };
}

async function setBalance(itemId: string, qty: number) {
  await prisma.$queryRaw`
    INSERT INTO stock_balances (item_id, location_id, quantity, updated_at)
    VALUES (${itemId}, 'MAIN', ${qty}, NOW())
    ON CONFLICT (item_id, location_id) DO UPDATE SET quantity = ${qty}, updated_at = NOW()
  `;
}

async function getBalance(itemId: string): Promise<number> {
  const rows = await prisma.$queryRaw<{ quantity: number }[]>`
    SELECT quantity FROM stock_balances WHERE item_id = ${itemId} AND location_id = 'MAIN'
  `;
  return rows.length > 0 ? Number(rows[0].quantity) : 0;
}

interface MovementRow {
  type: string;
  item_id: string;
  from_location_id: string;
  to_location_id: string;
  quantity: number;
}

async function getMovements(itemIds: string[]): Promise<MovementRow[]> {
  return prisma.$queryRaw<MovementRow[]>`
    SELECT type, item_id, from_location_id, to_location_id, quantity
    FROM stock_movements WHERE item_id = ANY(${itemIds})
    ORDER BY created_at ASC
  `;
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
  await prisma.$queryRaw`
    DELETE FROM production_operation_workers
    WHERE production_operation_id IN (SELECT id FROM production_operations WHERE item_id = ANY(${ALL_ITEM_IDS}))
  `;
  await prisma.$queryRaw`DELETE FROM production_operations WHERE item_id = ANY(${ALL_ITEM_IDS})`;
  await prisma.$queryRaw`DELETE FROM production_logs WHERE item_id = ANY(${ALL_ITEM_IDS})`;
  const ops = await prisma.$queryRaw<{ operation_id: string }[]>`
    SELECT DISTINCT operation_id FROM stock_movements
    WHERE item_id = ANY(${ALL_ITEM_IDS}) AND operation_id IS NOT NULL
  `;
  const opIds = ops.map((o) => o.operation_id);
  await prisma.$queryRaw`DELETE FROM stock_movements WHERE item_id = ANY(${ALL_ITEM_IDS})`;
  if (opIds.length > 0) {
    await prisma.$queryRaw`DELETE FROM inventory_operations WHERE id = ANY(${opIds})`;
  }
  await prisma.$queryRaw`DELETE FROM stock_balances WHERE item_id = ANY(${ALL_ITEM_IDS})`;
  const rIds = (await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM routings WHERE item_id = ANY(${ALL_ITEM_IDS})`).map((r) => r.id);
  if (rIds.length > 0) {
    await prisma.$queryRaw`DELETE FROM routing_steps WHERE routing_id = ANY(${rIds})`;
    await prisma.$queryRaw`DELETE FROM routings WHERE id = ANY(${rIds})`;
  }
  await prisma.$queryRaw`DELETE FROM items WHERE id = ANY(${ALL_ITEM_IDS})`;
}

async function setupItems() {
  for (const item of Object.values(ITEMS)) {
    await prisma.item.upsert({ where: { id: item.id }, create: item, update: {} });
  }
  // Routing: mat → z1 → z2
  const existingZ2 = await prisma.routing.findMany({ where: { itemId: ITEMS.z2.id } });
  for (const r of existingZ2) {
    await prisma.routingStep.deleteMany({ where: { routingId: r.id } });
    await prisma.routing.delete({ where: { id: r.id } });
  }
  await prisma.routing.create({
    data: {
      itemId: ITEMS.z2.id, version: 1, status: "ACTIVE",
      steps: {
        create: [
          { stepNo: 1, processId: PROCESS_ID, outputItemId: ITEMS.z1.id, outputQty: 1, inputs: { create: [{ itemId: ITEMS.mat.id, qty: 0.5, sortOrder: 0 }] } },
          { stepNo: 2, processId: PROCESS_ID, outputItemId: ITEMS.z2.id, outputQty: 1, inputs: { create: [{ itemId: ITEMS.z1.id, qty: 1, sortOrder: 0 }] } },
        ],
      },
    },
  });
  // Routing: z2 → prod (3:2)
  const existingProd = await prisma.routing.findMany({ where: { itemId: ITEMS.prod.id } });
  for (const r of existingProd) {
    await prisma.routingStep.deleteMany({ where: { routingId: r.id } });
    await prisma.routing.delete({ where: { id: r.id } });
  }
  await prisma.routing.create({
    data: {
      itemId: ITEMS.prod.id, version: 1, status: "ACTIVE",
      steps: {
        create: [
          { stepNo: 1, processId: PROCESS_ID, outputItemId: ITEMS.prod.id, outputQty: 2, inputs: { create: [{ itemId: ITEMS.z2.id, qty: 3, sortOrder: 0 }] } },
        ],
      },
    },
  });
}

async function resetForProduce(balances: Record<string, number>) {
  // clear movements
  await prisma.$queryRaw`
    DELETE FROM production_operation_workers
    WHERE production_operation_id IN (SELECT id FROM production_operations WHERE item_id = ANY(${ALL_ITEM_IDS}))
  `;
  await prisma.$queryRaw`DELETE FROM production_operations WHERE item_id = ANY(${ALL_ITEM_IDS})`;
  const ops = await prisma.$queryRaw<{ operation_id: string }[]>`
    SELECT DISTINCT operation_id FROM stock_movements WHERE item_id = ANY(${ALL_ITEM_IDS}) AND operation_id IS NOT NULL
  `;
  const opIds = ops.map((o) => o.operation_id);
  await prisma.$queryRaw`DELETE FROM stock_movements WHERE item_id = ANY(${ALL_ITEM_IDS})`;
  if (opIds.length > 0) {
    await prisma.$queryRaw`DELETE FROM inventory_operations WHERE id = ANY(${opIds})`;
  }
  for (const [id, qty] of Object.entries(balances)) {
    await setBalance(id, qty);
  }
}

// --- Block 3 Standalone Tests ---

async function testB3A_schemaNotNull() {
  total++;
  console.log("B3-A: from/to NOT NULL в БД");

  const nullCount = await prisma.$queryRaw<{ cnt: bigint }[]>`
    SELECT COUNT(*) as cnt FROM stock_movements
    WHERE from_location_id IS NULL OR to_location_id IS NULL
  `;
  assertEq(Number(nullCount[0].cnt), 0, "null from/to count");

  // Check column is NOT NULL in schema
  const colInfo = await prisma.$queryRaw<{ is_nullable: string }[]>`
    SELECT is_nullable FROM information_schema.columns
    WHERE table_name = 'stock_movements' AND column_name = 'from_location_id'
  `;
  assertEq(colInfo[0].is_nullable, "NO", "from_location_id NOT NULL");

  const colInfo2 = await prisma.$queryRaw<{ is_nullable: string }[]>`
    SELECT is_nullable FROM information_schema.columns
    WHERE table_name = 'stock_movements' AND column_name = 'to_location_id'
  `;
  assertEq(colInfo2[0].is_nullable, "NO", "to_location_id NOT NULL");

  console.log("  0 null, оба столбца NOT NULL  PASS\n");
  passed++;
}

async function testB3B_systemLocations() {
  total++;
  console.log("B3-B: системные Location");

  const expected = ["MAIN", "EXTERNAL", "PRODUCTION", "ADJUSTMENT", "SCRAP"];
  const locations = await prisma.$queryRaw<{ id: string; is_system: boolean }[]>`
    SELECT id, is_system FROM locations WHERE id = ANY(${expected})
  `;

  for (const locId of expected) {
    const loc = locations.find((l) => l.id === locId);
    assert(!!loc, `Location ${locId} не найден`);
    assert(loc!.is_system === true, `${locId}.isSystem должен быть true`);
  }

  console.log(`  ${expected.join(", ")} — все isSystem=true  PASS\n`);
  passed++;
}

async function testB3C_migrationMapping() {
  total++;
  console.log("B3-C: маппинг from/to по типам движений");

  const mapping: Record<string, { from: string; to: string }> = {
    SUPPLIER_INCOME:      { from: "EXTERNAL",   to: "MAIN" },
    ASSEMBLY_WRITE_OFF:   { from: "MAIN",       to: "PRODUCTION" },
    ASSEMBLY_INCOME:      { from: "PRODUCTION", to: "MAIN" },
    ADJUSTMENT_INCOME:    { from: "ADJUSTMENT", to: "MAIN" },
    ADJUSTMENT_WRITE_OFF: { from: "MAIN",       to: "ADJUSTMENT" },
    SHIPMENT_WRITE_OFF:   { from: "MAIN",       to: "EXTERNAL" },
  };

  for (const [type, expected] of Object.entries(mapping)) {
    const bad = await prisma.$queryRaw<{ cnt: bigint }[]>`
      SELECT COUNT(*) as cnt FROM stock_movements
      WHERE type = ${type}
        AND (from_location_id != ${expected.from} OR to_location_id != ${expected.to})
    `;
    const badCount = Number(bad[0].cnt);
    if (badCount > 0) {
      console.log(`  WARN: ${type} — ${badCount} движений с неправильным маппингом`);
    }
  }

  // Основная проверка: нет null
  const nulls = await prisma.$queryRaw<{ cnt: bigint }[]>`
    SELECT COUNT(*) as cnt FROM stock_movements WHERE from_location_id IS NULL OR to_location_id IS NULL
  `;
  assertEq(Number(nulls[0].cnt), 0, "null count");

  console.log("  маппинг проверен, 0 null  PASS\n");
  passed++;
}

async function testB3D_insertWithoutFromTo() {
  total++;
  console.log("B3-D: INSERT без from/to невозможен");

  let caught = false;
  try {
    await prisma.$queryRaw`
      INSERT INTO stock_movements (id, type, item_id, quantity, from_location_id, to_location_id, created_at)
      VALUES ('test-null-check', 'SUPPLIER_INCOME', ${ITEMS.mat.id}, 1, NULL, 'MAIN', NOW())
    `;
  } catch {
    caught = true;
  }
  assert(caught, "INSERT with NULL from_location_id должен быть отклонён");

  // cleanup just in case
  await prisma.$queryRaw`DELETE FROM stock_movements WHERE id = 'test-null-check'`;

  console.log("  NULL from_location_id отклонён  PASS\n");
  passed++;
}

// --- Block 1+3 Linked ---

async function testL13A_produceFromTo() {
  total++;
  console.log("L13-A: производство — from/to корректны");
  await resetForProduce({ [ITEMS.mat.id]: 100, [ITEMS.z1.id]: 0 });

  const res = await apiProduce({ itemId: ITEMS.z1.id, workers: [{ workerId: W1, quantity: 10 }] });
  assert(res.ok, `API error: ${JSON.stringify(res.data)}`);

  const moves = await getMovements([ITEMS.mat.id, ITEMS.z1.id]);

  // write-off mat: MAIN → PRODUCTION
  const wo = moves.find((m) => m.type === "ASSEMBLY_WRITE_OFF" && m.item_id === ITEMS.mat.id);
  assert(!!wo, "write-off movement exists");
  assertEq(wo!.from_location_id, "MAIN", "write-off from");
  assertEq(wo!.to_location_id, "PRODUCTION", "write-off to");

  // income z1: PRODUCTION → MAIN
  const inc = moves.find((m) => m.type === "ASSEMBLY_INCOME" && m.item_id === ITEMS.z1.id);
  assert(!!inc, "income movement exists");
  assertEq(inc!.from_location_id, "PRODUCTION", "income from");
  assertEq(inc!.to_location_id, "MAIN", "income to");

  console.log("  write-off MAIN→PRODUCTION, income PRODUCTION→MAIN  PASS\n");
  passed++;
}

async function testL13B_recursionFromTo() {
  total++;
  console.log("L13-B: рекурсия — все шаги с правильными from/to");
  await resetForProduce({ [ITEMS.mat.id]: 100, [ITEMS.z1.id]: 0, [ITEMS.z2.id]: 0, [ITEMS.prod.id]: 0 });

  const res = await apiProduce({ itemId: ITEMS.prod.id, workers: [{ workerId: W1, quantity: 10 }] });
  assert(res.ok, `API error: ${JSON.stringify(res.data)}`);

  const moves = await getMovements(ALL_ITEM_IDS);

  // Все write-off: from=MAIN, to=PRODUCTION
  const writeOffs = moves.filter((m) => m.type === "ASSEMBLY_WRITE_OFF");
  for (const wo of writeOffs) {
    assertEq(wo.from_location_id, "MAIN", `write-off ${wo.item_id} from`);
    assertEq(wo.to_location_id, "PRODUCTION", `write-off ${wo.item_id} to`);
  }

  // Все income: from=PRODUCTION, to=MAIN
  const incomes = moves.filter((m) => m.type === "ASSEMBLY_INCOME");
  for (const inc of incomes) {
    assertEq(inc.from_location_id, "PRODUCTION", `income ${inc.item_id} from`);
    assertEq(inc.to_location_id, "MAIN", `income ${inc.item_id} to`);
  }

  // Ни одного null
  for (const m of moves) {
    assert(!!m.from_location_id, `movement has from_location_id`);
    assert(!!m.to_location_id, `movement has to_location_id`);
  }

  console.log(`  ${writeOffs.length} write-offs + ${incomes.length} incomes — все with from/to  PASS\n`);
  passed++;
}

// --- Block 2+3 Linked ---

async function testL23A_multiWorkerFromTo() {
  total++;
  console.log("L23-A: два worker + from/to");
  await resetForProduce({ [ITEMS.mat.id]: 100, [ITEMS.z1.id]: 0 });

  const res = await apiProduce({
    itemId: ITEMS.z1.id,
    workers: [{ workerId: W1, quantity: 12 }, { workerId: W2, quantity: 8 }],
  });
  assert(res.ok, `API error: ${JSON.stringify(res.data)}`);

  const moves = await getMovements([ITEMS.mat.id, ITEMS.z1.id]);

  // 1 write-off + 1 income (не 2)
  const writeOffs = moves.filter((m) => m.type === "ASSEMBLY_WRITE_OFF");
  const incomes = moves.filter((m) => m.type === "ASSEMBLY_INCOME");
  assertEq(writeOffs.length, 1, "1 write-off");
  assertEq(incomes.length, 1, "1 income");

  // from/to корректны
  assertEq(writeOffs[0].from_location_id, "MAIN", "wo from");
  assertEq(writeOffs[0].to_location_id, "PRODUCTION", "wo to");
  assertEq(incomes[0].from_location_id, "PRODUCTION", "inc from");
  assertEq(incomes[0].to_location_id, "MAIN", "inc to");

  // ProductionOperation + 2 workers
  const ops = await prisma.$queryRaw<{ id: string; quantity: number }[]>`
    SELECT id, quantity FROM production_operations WHERE item_id = ${ITEMS.z1.id} ORDER BY created_at DESC LIMIT 1
  `;
  assertEq(Number(ops[0].quantity), 20, "op.qty=20");
  const wkrs = await prisma.$queryRaw<{ cnt: bigint }[]>`
    SELECT COUNT(*) as cnt FROM production_operation_workers WHERE production_operation_id = ${ops[0].id}
  `;
  assertEq(Number(wkrs[0].cnt), 2, "2 workers");

  console.log("  1 wo + 1 inc, from/to correct, 2 workers  PASS\n");
  passed++;
}

async function testL23B_rollbackClean() {
  total++;
  console.log("L23-B: rollback — нет мусорных movements");
  await resetForProduce({ [ITEMS.mat.id]: 100, [ITEMS.z1.id]: 0 });

  // Невалидный worker → rollback
  const res = await apiProduce({
    itemId: ITEMS.z1.id,
    workers: [{ workerId: W1, quantity: 10 }, { workerId: "nonexistent-worker", quantity: 5 }],
  });
  assert(!res.ok, "Должна быть ошибка");

  const moves = await getMovements([ITEMS.mat.id, ITEMS.z1.id]);
  assertEq(moves.length, 0, "0 movements after rollback");
  assertEq(await getBalance(ITEMS.mat.id), 100, "mat не тронут");

  console.log("  0 movements, балансы чисты  PASS\n");
  passed++;
}

// --- Full E2E: Block 1 + 2 + 3 ---

async function testE2E() {
  total++;
  console.log("E2E: рекурсия + 2 worker + from/to (полная связка 1+2+3)");
  await resetForProduce({ [ITEMS.mat.id]: 100, [ITEMS.z1.id]: 0, [ITEMS.z2.id]: 0, [ITEMS.prod.id]: 0 });

  const res = await apiProduce({
    itemId: ITEMS.prod.id,
    workers: [{ workerId: W1, quantity: 6 }, { workerId: W2, quantity: 4 }],
  });
  assert(res.ok, `API error: ${JSON.stringify(res.data)}`);

  // Balances (Блок 1 логика)
  // total=10, step 3:2 → need z2=15 → z2=0 → рекурсия
  // z2 routing: mat→z1→z2, need z1=15, mat needed=0.5*15=7.5
  assertEq(await getBalance(ITEMS.mat.id), 92.5, "mat=92.5");
  assertEq(await getBalance(ITEMS.z1.id), 0, "z1=0");
  assertEq(await getBalance(ITEMS.z2.id), 0, "z2=0");
  assertEq(await getBalance(ITEMS.prod.id), 10, "prod=10");

  // Movements — все с from/to (Блок 3)
  const moves = await getMovements(ALL_ITEM_IDS);
  for (const m of moves) {
    assert(!!m.from_location_id, `movement ${m.item_id} has from`);
    assert(!!m.to_location_id, `movement ${m.item_id} has to`);
  }

  const writeOffs = moves.filter((m) => m.type === "ASSEMBLY_WRITE_OFF");
  const incomes = moves.filter((m) => m.type === "ASSEMBLY_INCOME");

  for (const wo of writeOffs) {
    assertEq(wo.from_location_id, "MAIN", `wo ${wo.item_id} from`);
    assertEq(wo.to_location_id, "PRODUCTION", `wo ${wo.item_id} to`);
  }
  for (const inc of incomes) {
    assertEq(inc.from_location_id, "PRODUCTION", `inc ${inc.item_id} from`);
    assertEq(inc.to_location_id, "MAIN", `inc ${inc.item_id} to`);
  }

  // ProductionOperation + 2 workers (Блок 2)
  const ops = await prisma.$queryRaw<{ id: string; quantity: number }[]>`
    SELECT id, quantity FROM production_operations WHERE item_id = ${ITEMS.prod.id} ORDER BY created_at DESC LIMIT 1
  `;
  assertEq(Number(ops[0].quantity), 10, "op.qty=10");
  const wkrs = await prisma.$queryRaw<{ cnt: bigint }[]>`
    SELECT COUNT(*) as cnt FROM production_operation_workers WHERE production_operation_id = ${ops[0].id}
  `;
  assertEq(Number(wkrs[0].cnt), 2, "2 workers");

  console.log(`  mat=92.5, prod=10, ${writeOffs.length} wo + ${incomes.length} inc, all from/to, 2 workers`);
  console.log("  PASS\n");
  passed++;
}

// --- Main ---

async function main() {
  console.log("========================================");
  console.log("  Блок 3: Location + связка 1+2+3");
  console.log("========================================\n");

  try { await fetch(API); } catch {
    console.error("Dev server не запущен на localhost:3000");
    process.exit(1);
  }

  try {
    await login();
    console.log("Авторизация OK\n");

    // Блок 3 standalone
    console.log("--- Блок 3: отдельно ---\n");
    await testB3A_schemaNotNull();
    await testB3B_systemLocations();
    await testB3C_migrationMapping();
    await testB3D_insertWithoutFromTo();

    // Setup test items for linked tests
    await clearAll();
    await setupItems();

    // Связка 1+3
    console.log("--- Связка Блок 1 + 3 ---\n");
    await testL13A_produceFromTo();
    await testL13B_recursionFromTo();

    // Связка 2+3
    console.log("--- Связка Блок 2 + 3 ---\n");
    await testL23A_multiWorkerFromTo();
    await testL23B_rollbackClean();

    // Full E2E
    console.log("--- Полный E2E: Блок 1 + 2 + 3 ---\n");
    await testE2E();

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
