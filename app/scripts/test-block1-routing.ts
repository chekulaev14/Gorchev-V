/**
 * Тест Блока 1: Routing как source of truth для производства.
 * Запуск: cd app && npx tsx scripts/test-block1-routing.ts
 *
 * Требует: dev server на localhost:3000
 *
 * Сценарии:
 *   A — простой линейный шаг (1:1)
 *   B — не-1:1 пропорция (3:2)
 *   C — рекурсия при нехватке входного материала
 *   D — рекурсия НЕ запускается при достаточном остатке
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
const WORKER_PIN = "0000"; // Горчев
const PROCESS_ID = "cutting";
let authCookie = "";

const ITEMS = {
  // Scenario A
  amat:   { id: "test-b1a-mat",   code: "TST-A-MAT",   name: "Тест A Сырьё",      typeId: "material", unitId: "kg"  },
  az1:    { id: "test-b1a-z1",    code: "TST-A-Z1",    name: "Тест A З1",          typeId: "blank",    unitId: "pcs" },
  // Scenario B
  bz2:    { id: "test-b1b-z2",    code: "TST-B-Z2",    name: "Тест B З2",          typeId: "blank",    unitId: "pcs" },
  bprod:  { id: "test-b1b-prod",  code: "TST-B-PROD",  name: "Тест B Изделие",     typeId: "product",  unitId: "pcs" },
  // Scenario C/D
  cdmat:  { id: "test-b1cd-mat",  code: "TST-CD-MAT",  name: "Тест CD Сырьё",      typeId: "material", unitId: "kg"  },
  cdz1:   { id: "test-b1cd-z1",   code: "TST-CD-Z1",   name: "Тест CD З1",         typeId: "blank",    unitId: "pcs" },
  cdz2:   { id: "test-b1cd-z2",   code: "TST-CD-Z2",   name: "Тест CD З2",         typeId: "blank",    unitId: "pcs" },
  cdprod: { id: "test-b1cd-prod", code: "TST-CD-PROD", name: "Тест CD Изделие",    typeId: "product",  unitId: "pcs" },
};

const ALL_ITEM_IDS = Object.values(ITEMS).map((i) => i.id);

// --- Helpers ---

let passed = 0;
let failed = 0;

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

async function apiProduce(itemId: string, itemName: string, qty: number) {
  const res = await fetch(`${API}/api/terminal/output`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: authCookie,
    },
    body: JSON.stringify({ itemId, itemName, quantity: qty, pricePerUnit: 0 }),
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${body}`);
  }
  return JSON.parse(body);
}

async function getBalance(itemId: string): Promise<number> {
  const rows = await prisma.$queryRaw<{ quantity: number }[]>`
    SELECT quantity FROM stock_balances
    WHERE item_id = ${itemId} AND location_id = 'MAIN'
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

function assertBal(actual: number, expected: number, label: string) {
  const ok = Math.abs(actual - expected) < 0.001;
  if (!ok) throw new Error(`${label}: ожидалось ${expected}, получено ${actual}`);
}

async function clearMovements() {
  // production_operation_workers → production_operations (FK)
  await prisma.$queryRaw`
    DELETE FROM production_operation_workers
    WHERE production_operation_id IN (SELECT id FROM production_operations WHERE item_id = ANY(${ALL_ITEM_IDS}))
  `;
  await prisma.$queryRaw`DELETE FROM production_operations WHERE item_id = ANY(${ALL_ITEM_IDS})`;

  const ops = await prisma.$queryRaw<{ operation_id: string }[]>`
    SELECT DISTINCT operation_id FROM stock_movements
    WHERE item_id = ANY(${ALL_ITEM_IDS}) AND operation_id IS NOT NULL
  `;
  const opIds = ops.map((o) => o.operation_id);

  await prisma.$queryRaw`DELETE FROM production_logs WHERE item_id = ANY(${ALL_ITEM_IDS})`;
  await prisma.$queryRaw`DELETE FROM stock_movements WHERE item_id = ANY(${ALL_ITEM_IDS})`;
  if (opIds.length > 0) {
    await prisma.$queryRaw`DELETE FROM inventory_operations WHERE id = ANY(${opIds})`;
  }
}

// --- Setup ---

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
      itemId,
      version: 1,
      status: "ACTIVE",
      steps: {
        create: steps.map((s) => ({
          stepNo: s.stepNo,
          processId: PROCESS_ID,
          inputItemId: s.inputItemId,
          outputItemId: s.outputItemId,
          inputQty: s.inputQty,
          outputQty: s.outputQty,
        })),
      },
    },
  });
}

async function setup() {
  console.log("Создание тестовых данных...\n");

  for (const item of Object.values(ITEMS)) {
    await prisma.item.upsert({
      where: { id: item.id },
      create: item,
      update: {},
    });
  }

  // A: mat → z1 (1:1)
  await createRouting(ITEMS.az1.id, [
    { stepNo: 1, inputItemId: ITEMS.amat.id, outputItemId: ITEMS.az1.id, inputQty: 1, outputQty: 1 },
  ]);

  // B: z2 → prod (3:2)
  await createRouting(ITEMS.bprod.id, [
    { stepNo: 1, inputItemId: ITEMS.bz2.id, outputItemId: ITEMS.bprod.id, inputQty: 3, outputQty: 2 },
  ]);

  // CD-A: mat → z1 → z2
  await createRouting(ITEMS.cdz2.id, [
    { stepNo: 1, inputItemId: ITEMS.cdmat.id, outputItemId: ITEMS.cdz1.id, inputQty: 0.5, outputQty: 1 },
    { stepNo: 2, inputItemId: ITEMS.cdz1.id,  outputItemId: ITEMS.cdz2.id, inputQty: 1,   outputQty: 1 },
  ]);

  // CD-B: z2 → prod
  await createRouting(ITEMS.cdprod.id, [
    { stepNo: 1, inputItemId: ITEMS.cdz2.id, outputItemId: ITEMS.cdprod.id, inputQty: 1, outputQty: 1 },
  ]);
}

// --- Tests ---

async function testA() {
  console.log("Сценарий A — простой линейный шаг (1:1)");
  console.log("  mat=10, produce(z1, 5) → mat=5, z1=5");

  await setBalance(ITEMS.amat.id, 10);
  await setBalance(ITEMS.az1.id, 0);

  await apiProduce(ITEMS.az1.id, ITEMS.az1.name, 5);

  const mat = await getBalance(ITEMS.amat.id);
  const z1 = await getBalance(ITEMS.az1.id);

  assertBal(mat, 5, "mat");
  assertBal(z1, 5, "z1");

  console.log(`  mat=${mat}, z1=${z1}  PASS\n`);
  passed++;
}

async function testB() {
  console.log("Сценарий B — не-1:1 (inputQty=3, outputQty=2)");
  console.log("  z2=15, produce(prod, 10) → z2=0, prod=10");

  await setBalance(ITEMS.bz2.id, 15);
  await setBalance(ITEMS.bprod.id, 0);

  await apiProduce(ITEMS.bprod.id, ITEMS.bprod.name, 10);

  const z2 = await getBalance(ITEMS.bz2.id);
  const prod = await getBalance(ITEMS.bprod.id);

  assertBal(z2, 0, "z2 (15 - 3/2*10 = 0)");
  assertBal(prod, 10, "prod");

  console.log(`  z2=${z2}, prod=${prod}  PASS\n`);
  passed++;
}

async function testD() {
  console.log("Сценарий D — рекурсия НЕ запускается (остатка хватает)");
  console.log("  z2=15, mat=100, produce(prod, 10) → z2=5, mat=100");

  await setBalance(ITEMS.cdmat.id, 100);
  await setBalance(ITEMS.cdz1.id, 0);
  await setBalance(ITEMS.cdz2.id, 15);
  await setBalance(ITEMS.cdprod.id, 0);

  await apiProduce(ITEMS.cdprod.id, ITEMS.cdprod.name, 10);

  const mat = await getBalance(ITEMS.cdmat.id);
  const z1 = await getBalance(ITEMS.cdz1.id);
  const z2 = await getBalance(ITEMS.cdz2.id);
  const prod = await getBalance(ITEMS.cdprod.id);

  assertBal(mat, 100, "mat (не тронут)");
  assertBal(z1, 0, "z1 (не тронут)");
  assertBal(z2, 5, "z2 (15-10)");
  assertBal(prod, 10, "prod");

  console.log(`  mat=${mat}, z1=${z1}, z2=${z2}, prod=${prod}  PASS\n`);
  passed++;
}

async function testC() {
  console.log("Сценарий C — рекурсия при нехватке");
  console.log("  z2=0, mat=100, produce(prod, 10) → z2=0, mat=95, prod=10");

  await clearMovements();
  await setBalance(ITEMS.cdmat.id, 100);
  await setBalance(ITEMS.cdz1.id, 0);
  await setBalance(ITEMS.cdz2.id, 0);
  await setBalance(ITEMS.cdprod.id, 0);

  await apiProduce(ITEMS.cdprod.id, ITEMS.cdprod.name, 10);

  const mat = await getBalance(ITEMS.cdmat.id);
  const z1 = await getBalance(ITEMS.cdz1.id);
  const z2 = await getBalance(ITEMS.cdz2.id);
  const prod = await getBalance(ITEMS.cdprod.id);

  assertBal(mat, 95, "mat (100 - 0.5*10 = 95)");
  assertBal(z1, 0, "z1 (приход-списание = 0)");
  assertBal(z2, 0, "z2 (приход-списание = 0)");
  assertBal(prod, 10, "prod");

  console.log(`  mat=${mat}, z1=${z1}, z2=${z2}, prod=${prod}  PASS\n`);
  passed++;
}

// --- Cleanup ---

async function cleanup() {
  await clearMovements();

  await prisma.$queryRaw`
    DELETE FROM stock_balances WHERE item_id = ANY(${ALL_ITEM_IDS})
  `;

  const routingIds = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM routings WHERE item_id = ANY(${ALL_ITEM_IDS})
  `;
  const rIds = routingIds.map((r) => r.id);
  if (rIds.length > 0) {
    await prisma.$queryRaw`DELETE FROM routing_steps WHERE routing_id = ANY(${rIds})`;
    await prisma.$queryRaw`DELETE FROM routings WHERE id = ANY(${rIds})`;
  }

  await prisma.$queryRaw`DELETE FROM items WHERE id = ANY(${ALL_ITEM_IDS})`;
}

// --- Main ---

async function main() {
  console.log("========================================");
  console.log("  Блок 1: Тесты Routing Production");
  console.log("========================================\n");

  try {
    await fetch(API);
  } catch {
    console.error("Dev server не запущен на localhost:3000");
    console.error("Запустите: cd app && npm run dev");
    process.exit(1);
  }

  try {
    await login();
    console.log("Авторизация OK\n");

    await cleanup();
    await setup();

    await testA();
    await testB();
    await testD(); // D перед C — сначала с остатком
    await testC(); // потом без остатка (рекурсия)

    console.log("========================================");
    console.log(`  ${passed}/4 сценариев пройдено`);
    console.log("========================================");
  } catch (err) {
    failed++;
    console.error(`\nFAIL: ${(err as Error).message}`);
    console.error(`  ${passed} passed, ${failed} failed`);
    process.exit(1);
  } finally {
    await cleanup();
    await prisma.$disconnect();
    pool.end();
  }
}

main();
