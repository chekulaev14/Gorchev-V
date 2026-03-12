/**
 * Factory helpers и cleanup для integration-тестов.
 * Работают с реальной dev БД (erp_dev).
 */
import { prisma } from "@/lib/prisma";

let counter = 0;

function uid() {
  return `test-${Date.now()}-${++counter}-${Math.random().toString(36).slice(2, 6)}`;
}

function testCode() {
  // Code format: /^[A-Z]{2,4}-\d{3,4}$/ → ZZ-XXXX where XXXX is random 4 digits
  const num = String(Math.floor(Math.random() * 9000) + 1000);
  return `ZZ-${num}`;
}

// Track created IDs for cleanup
const createdIds: {
  items: string[];
  boms: string[];
  bomLines: string[];
  routings: string[];
  routingSteps: string[];
  routingStepInputs: string[];
  inventoryOperations: string[];
  stockMovements: string[];
  stockBalances: { itemId: string; locationId: string }[];
  productionOperations: string[];
  productionOrders: string[];
} = {
  items: [],
  boms: [],
  bomLines: [],
  routings: [],
  routingSteps: [],
  routingStepInputs: [],
  inventoryOperations: [],
  stockMovements: [],
  stockBalances: [],
  productionOperations: [],
  productionOrders: [],
};

export function resetTracker() {
  createdIds.items = [];
  createdIds.boms = [];
  createdIds.bomLines = [];
  createdIds.routings = [];
  createdIds.routingSteps = [];
  createdIds.routingStepInputs = [];
  createdIds.inventoryOperations = [];
  createdIds.stockMovements = [];
  createdIds.stockBalances = [];
  createdIds.productionOperations = [];
  createdIds.productionOrders = [];
  // НЕ сбрасываем counter — чтобы коды были уникальны между тестами
}

// ============================================================
// Factory: Item
// ============================================================

export async function createItem(params: {
  code?: string;
  name?: string;
  type?: "material" | "blank" | "product";
  unit?: "pcs" | "kg" | "m";
  side?: "LEFT" | "RIGHT" | "NONE";
}) {
  const id = uid();
  const type = params.type ?? "blank";
  const kind = type === "material" ? "MAT" : type === "product" ? "PRD" : "BLK";
  const code = params.code ?? testCode(kind);
  const item = await prisma.item.create({
    data: {
      id,
      code,
      name: params.name ?? `Test ${type} ${code}`,
      typeId: type,
      unitId: params.unit ?? (type === "material" ? "kg" : "pcs"),
      side: params.side ?? "NONE",
      images: [],
    },
  });
  createdIds.items.push(id);
  return item;
}

// ============================================================
// Factory: StockBalance (direct, for test setup)
// ============================================================

export async function createStockBalance(itemId: string, qty: number, locationId = "MAIN") {
  await prisma.$queryRaw`
    INSERT INTO stock_balances (item_id, location_id, quantity, updated_at)
    VALUES (${itemId}, ${locationId}, ${qty}, NOW())
    ON CONFLICT (item_id, location_id)
    DO UPDATE SET quantity = ${qty}, updated_at = NOW()
  `;
  createdIds.stockBalances.push({ itemId, locationId });
}

// ============================================================
// Factory: BOM (active)
// ============================================================

export async function createActiveBom(params: {
  parentId: string;
  components: { itemId: string; qty: number }[];
}) {
  const bomId = uid();
  const maxV = await prisma.bom.aggregate({ where: { itemId: params.parentId }, _max: { version: true } });
  const version = (maxV._max.version ?? 0) + 1;

  const bom = await prisma.bom.create({
    data: {
      id: bomId,
      itemId: params.parentId,
      version,
      status: "ACTIVE",
      effectiveFrom: new Date(),
      lines: {
        create: params.components.map((c, i) => ({
          id: uid(),
          lineNo: i + 1,
          componentItemId: c.itemId,
          quantity: c.qty,
        })),
      },
    },
    include: { lines: true },
  });
  createdIds.boms.push(bomId);
  for (const line of bom.lines) createdIds.bomLines.push(line.id);
  return bom;
}

// ============================================================
// Factory: Routing (active)
// ============================================================

export async function createActiveRouting(params: {
  itemId: string;
  steps: {
    stepNo: number;
    processId: string;
    outputItemId: string;
    outputQty: number;
    inputs: { itemId: string; qty: number; sortOrder: number }[];
  }[];
}) {
  const routingId = uid();
  const maxV = await prisma.routing.aggregate({ where: { itemId: params.itemId }, _max: { version: true } });
  const version = (maxV._max.version ?? 0) + 1;

  const routing = await prisma.routing.create({
    data: {
      id: routingId,
      itemId: params.itemId,
      version,
      status: "ACTIVE",
      steps: {
        create: params.steps.map((s) => ({
          id: uid(),
          stepNo: s.stepNo,
          processId: s.processId,
          outputItemId: s.outputItemId,
          outputQty: s.outputQty,
          inputs: {
            create: s.inputs.map((inp) => ({
              id: uid(),
              itemId: inp.itemId,
              qty: inp.qty,
              sortOrder: inp.sortOrder,
            })),
          },
        })),
      },
    },
    include: { steps: { include: { inputs: true } } },
  });
  createdIds.routings.push(routingId);
  for (const s of routing.steps) {
    createdIds.routingSteps.push(s.id);
    for (const inp of s.inputs) createdIds.routingStepInputs.push(inp.id);
  }
  return routing;
}

// ============================================================
// Factory: Process (ensure exists)
// ============================================================

export async function ensureProcess(id: string, name?: string) {
  const existing = await prisma.process.findUnique({ where: { id } });
  if (existing) return existing;

  // Ensure process group exists
  const groupId = "test-group";
  await prisma.processGroup.upsert({
    where: { id: groupId },
    create: { id: groupId, name: "Test Group" },
    update: {},
  });

  return prisma.process.create({
    data: { id, name: name ?? `Test Process ${id}`, groupId },
  });
}

// ============================================================
// Cleanup — delete in FK-safe order
// ============================================================

export async function cleanup() {
  // Удаляем в обратном порядке зависимостей
  if (createdIds.productionOrders.length > 0) {
    await prisma.productionOrderItem.deleteMany({ where: { orderId: { in: createdIds.productionOrders } } });
    await prisma.productionOrderStatusHistory.deleteMany({ where: { orderId: { in: createdIds.productionOrders } } });
    await prisma.productionOrder.deleteMany({ where: { id: { in: createdIds.productionOrders } } });
  }

  if (createdIds.productionOperations.length > 0) {
    await prisma.productionOperationWorker.deleteMany({ where: { productionOperationId: { in: createdIds.productionOperations } } });
    await prisma.productionOperation.deleteMany({ where: { id: { in: createdIds.productionOperations } } });
  }

  if (createdIds.stockMovements.length > 0) {
    await prisma.stockMovement.deleteMany({ where: { id: { in: createdIds.stockMovements } } });
  }

  if (createdIds.inventoryOperations.length > 0) {
    await prisma.inventoryOperation.deleteMany({ where: { id: { in: createdIds.inventoryOperations } } });
  }

  for (const bal of createdIds.stockBalances) {
    await prisma.stockBalance.deleteMany({
      where: { itemId: bal.itemId, locationId: bal.locationId },
    });
  }

  if (createdIds.routingStepInputs.length > 0) {
    await prisma.routingStepInput.deleteMany({ where: { id: { in: createdIds.routingStepInputs } } });
  }
  if (createdIds.routingSteps.length > 0) {
    await prisma.routingStep.deleteMany({ where: { id: { in: createdIds.routingSteps } } });
  }
  if (createdIds.routings.length > 0) {
    await prisma.routing.deleteMany({ where: { id: { in: createdIds.routings } } });
  }

  if (createdIds.bomLines.length > 0) {
    await prisma.bomLine.deleteMany({ where: { id: { in: createdIds.bomLines } } });
  }
  if (createdIds.boms.length > 0) {
    await prisma.bom.deleteMany({ where: { id: { in: createdIds.boms } } });
  }

  if (createdIds.items.length > 0) {
    // Сначала удалить BOM entries если есть
    await prisma.bomEntry.deleteMany({
      where: { OR: [{ parentId: { in: createdIds.items } }, { childId: { in: createdIds.items } }] },
    });
    // Удалить routing данные, созданные через сервис (не трекнутые)
    const untrackedRoutings = await prisma.routing.findMany({
      where: { itemId: { in: createdIds.items } },
      include: { steps: { include: { inputs: true } } },
    });
    for (const r of untrackedRoutings) {
      for (const s of r.steps) {
        await prisma.routingStepInput.deleteMany({ where: { stepId: s.id } });
      }
      await prisma.routingStep.deleteMany({ where: { routingId: r.id } });
    }
    await prisma.routing.deleteMany({ where: { itemId: { in: createdIds.items } } });

    // Удалить BOM данные, созданные через сервис
    const untrackedBoms = await prisma.bom.findMany({
      where: { itemId: { in: createdIds.items } },
    });
    if (untrackedBoms.length > 0) {
      await prisma.bomLine.deleteMany({ where: { bomId: { in: untrackedBoms.map((b) => b.id) } } });
      await prisma.bom.deleteMany({ where: { itemId: { in: createdIds.items } } });
    }

    // Удалить stock movements и operations
    const movements = await prisma.stockMovement.findMany({
      where: { itemId: { in: createdIds.items } },
      select: { id: true, operationId: true },
    });
    if (movements.length > 0) {
      await prisma.stockMovement.deleteMany({ where: { itemId: { in: createdIds.items } } });
      const opIds = movements.map((m) => m.operationId).filter(Boolean) as string[];
      if (opIds.length > 0) {
        await prisma.inventoryOperation.deleteMany({ where: { id: { in: opIds } } });
      }
    }

    await prisma.stockBalance.deleteMany({ where: { itemId: { in: createdIds.items } } });
    await prisma.item.deleteMany({ where: { id: { in: createdIds.items } } });
  }

  resetTracker();
}

export { prisma };
