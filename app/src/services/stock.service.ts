import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/lib/api/handle-route-error";
import type { MovementType } from "@/lib/types";
import { toNumber } from "./helpers/serialize";

const DEFAULT_LOCATION = "MAIN";

const INCOME_TYPES: MovementType[] = [
  "SUPPLIER_INCOME",
  "PRODUCTION_INCOME",
  "ASSEMBLY_INCOME",
  "ADJUSTMENT_INCOME",
];

/** Маппинг from/to Location по типу движения */
const LOCATION_MAP: Record<string, { from: string; to: string }> = {
  SUPPLIER_INCOME:      { from: "EXTERNAL",    to: "MAIN" },
  PRODUCTION_INCOME:    { from: "PRODUCTION",  to: "MAIN" },
  ASSEMBLY_WRITE_OFF:   { from: "MAIN",        to: "PRODUCTION" },
  ASSEMBLY_INCOME:      { from: "PRODUCTION",  to: "MAIN" },
  ADJUSTMENT_INCOME:    { from: "ADJUSTMENT",  to: "MAIN" },
  ADJUSTMENT_WRITE_OFF: { from: "MAIN",        to: "ADJUSTMENT" },
  SHIPMENT_WRITE_OFF:   { from: "MAIN",        to: "EXTERNAL" },
};

function getLocationsByType(
  type: MovementType,
): { fromLocationId: string; toLocationId: string } {
  const mapping = LOCATION_MAP[type];
  if (!mapping) {
    return { fromLocationId: "MAIN", toLocationId: "MAIN" };
  }
  return { fromLocationId: mapping.from, toLocationId: mapping.to };
}

/** Баланс-дельта: +1 для прихода, -1 для списания */
function balanceDelta(type: MovementType): number {
  return INCOME_TYPES.includes(type) ? 1 : -1;
}

// --- Read ---

export async function getBalance(itemId: string): Promise<number> {
  const row = await prisma.stockBalance.findUnique({
    where: { itemId_locationId: { itemId, locationId: DEFAULT_LOCATION } },
  });
  return row ? toNumber(row.quantity) : 0;
}

export async function getBulkBalances(itemIds: string[]): Promise<Record<string, number>> {
  if (itemIds.length === 0) return {};
  const rows = await prisma.stockBalance.findMany({
    where: { itemId: { in: itemIds }, locationId: DEFAULT_LOCATION },
  });
  const balances: Record<string, number> = {};
  for (const id of itemIds) balances[id] = 0;
  for (const row of rows) balances[row.itemId] = toNumber(row.quantity);
  return balances;
}

export async function getAllBalances(): Promise<Record<string, number>> {
  const [rows, items] = await Promise.all([
    prisma.stockBalance.findMany({ where: { locationId: DEFAULT_LOCATION } }),
    prisma.item.findMany({ select: { id: true } }),
  ]);
  const balances: Record<string, number> = {};
  for (const item of items) balances[item.id] = 0;
  for (const row of rows) balances[row.itemId] = toNumber(row.quantity);
  return balances;
}

// --- Write ---

export async function getMovements(itemId?: string, limit = 100) {
  const movements = await prisma.stockMovement.findMany({
    where: itemId ? { itemId } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return movements.map((m) => ({ ...m, quantity: toNumber(m.quantity) }));
}

export async function createMovement(data: {
  type: MovementType;
  itemId: string;
  quantity: number;
  workerId?: string;
  comment?: string;
  createdById?: string;
  locationId?: string;
  operationId?: string;
}) {
  const locationId = data.locationId ?? DEFAULT_LOCATION;
  const { fromLocationId, toLocationId } = getLocationsByType(data.type);
  const delta = balanceDelta(data.type);

  return prisma.$transaction(async (tx) => {
    // Блокируем строку StockBalance (или создаём)
    await tx.$queryRaw`
      INSERT INTO stock_balances (item_id, location_id, quantity, updated_at)
      VALUES (${data.itemId}, ${locationId}, 0, NOW())
      ON CONFLICT (item_id, location_id) DO NOTHING
    `;
    await tx.$queryRaw`
      SELECT * FROM stock_balances
      WHERE item_id = ${data.itemId} AND location_id = ${locationId}
      FOR UPDATE
    `;

    // При списании — проверяем остаток
    if (delta < 0) {
      const [row] = await tx.$queryRaw<[{ quantity: number }]>`
        SELECT quantity FROM stock_balances
        WHERE item_id = ${data.itemId} AND location_id = ${locationId}
      `;
      if (toNumber(row.quantity) < data.quantity) {
        throw new ServiceError(`Недостаточно остатка: ${toNumber(row.quantity)} < ${data.quantity}`, 400);
      }
    }

    const movement = await tx.stockMovement.create({
      data: {
        type: data.type,
        itemId: data.itemId,
        quantity: data.quantity,
        workerId: data.workerId,
        comment: data.comment,
        createdById: data.createdById,
        operationId: data.operationId,
        fromLocationId,
        toLocationId,
      },
    });

    await tx.$queryRaw`
      UPDATE stock_balances
      SET quantity = quantity + ${delta * data.quantity}, updated_at = NOW()
      WHERE item_id = ${data.itemId} AND location_id = ${locationId}
    `;

    return movement;
  });
}

export async function createIncomeOperation(params: {
  type: "SUPPLIER_INCOME" | "PRODUCTION_INCOME";
  itemId: string;
  quantity: number;
  workerId?: string;
  createdById?: string;
  comment?: string;
  operationKey?: string;
}) {
  const { type, itemId, quantity, workerId, createdById, comment, operationKey } = params;
  const prefix = type === "SUPPLIER_INCOME" ? "si" : "pi";
  const opKey = operationKey ?? `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return prisma.$transaction(async (tx) => {
    // Idempotency: если operationKey уже существует — вернуть существующий результат
    const existing = await tx.inventoryOperation.findUnique({
      where: { operationKey: opKey },
      include: { movements: { select: { id: true, type: true, quantity: true } } },
    });
    if (existing) {
      const bal = await tx.stockBalance.findUnique({
        where: { itemId_locationId: { itemId, locationId: DEFAULT_LOCATION } },
      });
      return {
        movement: existing.movements[0] ?? { id: existing.id },
        balance: bal ? toNumber(bal.quantity) : 0,
        operationKey: opKey,
      };
    }

    // Создаём операцию (MovementType → InventoryOperationType)
    const operation = await tx.inventoryOperation.create({
      data: { operationKey: opKey, type: "SUPPLIER_RECEIPT", createdById },
    });

    // Блокируем строку StockBalance (или создаём)
    await tx.$queryRaw`
      INSERT INTO stock_balances (item_id, location_id, quantity, updated_at)
      VALUES (${itemId}, ${DEFAULT_LOCATION}, 0, NOW())
      ON CONFLICT (item_id, location_id) DO NOTHING
    `;
    await tx.$queryRaw`
      SELECT * FROM stock_balances
      WHERE item_id = ${itemId} AND location_id = ${DEFAULT_LOCATION}
      FOR UPDATE
    `;

    const { fromLocationId, toLocationId } = getLocationsByType(type);

    const movement = await tx.stockMovement.create({
      data: {
        type,
        itemId,
        quantity,
        workerId,
        comment,
        createdById,
        operationId: operation.id,
        fromLocationId,
        toLocationId,
      },
    });

    await tx.$queryRaw`
      UPDATE stock_balances
      SET quantity = quantity + ${quantity}, updated_at = NOW()
      WHERE item_id = ${itemId} AND location_id = ${DEFAULT_LOCATION}
    `;

    const [bal] = await tx.$queryRaw<[{ quantity: number }]>`
      SELECT quantity FROM stock_balances
      WHERE item_id = ${itemId} AND location_id = ${DEFAULT_LOCATION}
    `;

    return {
      movement: { id: movement.id },
      balance: toNumber(bal.quantity),
      operationKey: opKey,
    };
  });
}

export async function createShipmentOperation(params: {
  itemId: string;
  quantity: number;
  createdById?: string;
  comment?: string;
  operationKey?: string;
}) {
  const { itemId, quantity, createdById, comment, operationKey } = params;
  const opKey = operationKey ?? `sh-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return prisma.$transaction(async (tx) => {
    // Idempotency
    const existing = await tx.inventoryOperation.findUnique({
      where: { operationKey: opKey },
      include: { movements: { select: { id: true, type: true, quantity: true } } },
    });
    if (existing) {
      const bal = await tx.stockBalance.findUnique({
        where: { itemId_locationId: { itemId, locationId: DEFAULT_LOCATION } },
      });
      return {
        movement: existing.movements[0] ?? { id: existing.id },
        balance: bal ? toNumber(bal.quantity) : 0,
        operationKey: opKey,
      };
    }

    // Блокируем строку StockBalance (или создаём)
    await tx.$queryRaw`
      INSERT INTO stock_balances (item_id, location_id, quantity, updated_at)
      VALUES (${itemId}, ${DEFAULT_LOCATION}, 0, NOW())
      ON CONFLICT (item_id, location_id) DO NOTHING
    `;
    await tx.$queryRaw`
      SELECT * FROM stock_balances
      WHERE item_id = ${itemId} AND location_id = ${DEFAULT_LOCATION}
      FOR UPDATE
    `;

    // Проверяем остаток
    const [row] = await tx.$queryRaw<[{ quantity: number }]>`
      SELECT quantity FROM stock_balances
      WHERE item_id = ${itemId} AND location_id = ${DEFAULT_LOCATION}
    `;
    if (toNumber(row.quantity) < quantity) {
      throw new ServiceError(`Недостаточно остатка: ${toNumber(row.quantity)} < ${quantity}`, 400);
    }

    const operation = await tx.inventoryOperation.create({
      data: { operationKey: opKey, type: "SHIPMENT", createdById },
    });

    const movement = await tx.stockMovement.create({
      data: {
        type: "SHIPMENT_WRITE_OFF",
        itemId,
        quantity,
        comment,
        createdById,
        operationId: operation.id,
        fromLocationId: "MAIN",
        toLocationId: "EXTERNAL",
      },
    });

    await tx.$queryRaw`
      UPDATE stock_balances
      SET quantity = quantity - ${quantity}, updated_at = NOW()
      WHERE item_id = ${itemId} AND location_id = ${DEFAULT_LOCATION}
    `;

    const [bal] = await tx.$queryRaw<[{ quantity: number }]>`
      SELECT quantity FROM stock_balances
      WHERE item_id = ${itemId} AND location_id = ${DEFAULT_LOCATION}
    `;

    return {
      movement: { id: movement.id },
      balance: toNumber(bal.quantity),
      operationKey: opKey,
    };
  });
}

export async function createAdjustmentOperation(params: {
  itemId: string;
  quantity: number; // положительное — приход, отрицательное — списание
  createdById?: string;
  comment?: string;
  operationKey?: string;
}) {
  const { itemId, quantity, createdById, comment, operationKey } = params;
  const opKey = operationKey ?? `adj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const isIncome = quantity > 0;
  const absQty = Math.abs(quantity);
  const movementType: MovementType = isIncome ? "ADJUSTMENT_INCOME" : "ADJUSTMENT_WRITE_OFF";

  return prisma.$transaction(async (tx) => {
    const existing = await tx.inventoryOperation.findUnique({
      where: { operationKey: opKey },
      include: { movements: { select: { id: true, type: true, quantity: true } } },
    });
    if (existing) {
      const bal = await tx.stockBalance.findUnique({
        where: { itemId_locationId: { itemId, locationId: DEFAULT_LOCATION } },
      });
      return {
        movement: existing.movements[0] ?? { id: existing.id },
        balance: bal ? toNumber(bal.quantity) : 0,
        operationKey: opKey,
      };
    }

    await tx.$queryRaw`
      INSERT INTO stock_balances (item_id, location_id, quantity, updated_at)
      VALUES (${itemId}, ${DEFAULT_LOCATION}, 0, NOW())
      ON CONFLICT (item_id, location_id) DO NOTHING
    `;
    await tx.$queryRaw`
      SELECT * FROM stock_balances
      WHERE item_id = ${itemId} AND location_id = ${DEFAULT_LOCATION}
      FOR UPDATE
    `;

    if (!isIncome) {
      const [row] = await tx.$queryRaw<[{ quantity: number }]>`
        SELECT quantity FROM stock_balances
        WHERE item_id = ${itemId} AND location_id = ${DEFAULT_LOCATION}
      `;
      if (toNumber(row.quantity) < absQty) {
        throw new ServiceError(`Недостаточно остатка: ${toNumber(row.quantity)} < ${absQty}`, 400);
      }
    }

    const operation = await tx.inventoryOperation.create({
      data: { operationKey: opKey, type: "ADJUSTMENT", createdById },
    });

    const { fromLocationId, toLocationId } = getLocationsByType(movementType);

    const movement = await tx.stockMovement.create({
      data: {
        type: movementType,
        itemId,
        quantity: absQty,
        comment,
        createdById,
        operationId: operation.id,
        fromLocationId,
        toLocationId,
      },
    });

    const delta = isIncome ? absQty : -absQty;
    await tx.$queryRaw`
      UPDATE stock_balances
      SET quantity = quantity + ${delta}, updated_at = NOW()
      WHERE item_id = ${itemId} AND location_id = ${DEFAULT_LOCATION}
    `;

    const [bal] = await tx.$queryRaw<[{ quantity: number }]>`
      SELECT quantity FROM stock_balances
      WHERE item_id = ${itemId} AND location_id = ${DEFAULT_LOCATION}
    `;

    return {
      movement: { id: movement.id },
      balance: toNumber(bal.quantity),
      operationKey: opKey,
    };
  });
}

export async function validateItemExists(itemId: string) {
  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item) return null;
  return item;
}
