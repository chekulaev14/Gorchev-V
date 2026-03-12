import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/lib/api/handle-route-error";
import { toNumber } from "./helpers/serialize";

const DEFAULT_LOCATION = "MAIN";

export class ProductionOrderError extends Error {
  constructor(
    message: string,
    public shortages?: { name: string; needed: number; available: number }[],
  ) {
    super(message);
    this.name = "ProductionOrderError";
  }
}

type OrderStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

interface OrderDTO {
  id: string;
  status: OrderStatus;
  itemId: string;
  itemName: string;
  quantityPlanned: number;
  quantityCompleted: number;
  createdBy: string;
  creatorName: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  snapshotItems: { itemId: string; itemName: string; quantity: number }[];
}

function mapOrder(order: {
  id: string;
  status: string;
  itemId: string;
  itemName: string;
  quantityPlanned: number;
  quantityCompleted: number;
  createdBy: string;
  creator: { name: string };
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  snapshotItems: { itemId: string; itemName: string; quantity: { toNumber?: () => number } | number }[];
}): OrderDTO {
  return {
    id: order.id,
    status: order.status as OrderStatus,
    itemId: order.itemId,
    itemName: order.itemName,
    quantityPlanned: order.quantityPlanned,
    quantityCompleted: order.quantityCompleted,
    createdBy: order.createdBy,
    creatorName: order.creator.name,
    createdAt: order.createdAt.toISOString(),
    startedAt: order.startedAt?.toISOString() ?? null,
    completedAt: order.completedAt?.toISOString() ?? null,
    snapshotItems: order.snapshotItems.map((si) => ({
      itemId: si.itemId,
      itemName: si.itemName,
      quantity: toNumber(si.quantity),
    })),
  };
}

const includeSnapshot = {
  creator: { select: { name: true } },
  snapshotItems: { select: { itemId: true, itemName: true, quantity: true } },
};

// --- StatusHistory helper ---

async function writeStatusHistory(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  orderId: string,
  fromStatus: OrderStatus,
  toStatus: OrderStatus,
  changedById?: string | null,
  comment?: string,
) {
  await tx.productionOrderStatusHistory.create({
    data: { orderId, fromStatus, toStatus, changedById, comment },
  });
}

// --- Read ---

export async function getOrders(status?: OrderStatus): Promise<OrderDTO[]> {
  const orders = await prisma.productionOrder.findMany({
    where: status ? { status } : undefined,
    include: includeSnapshot,
    orderBy: { createdAt: "desc" },
  });
  return orders.map(mapOrder);
}

export async function getOrder(id: string): Promise<OrderDTO | null> {
  const order = await prisma.productionOrder.findUnique({
    where: { id },
    include: includeSnapshot,
  });
  return order ? mapOrder(order) : null;
}

// --- Write ---

export async function createOrder(params: {
  itemId: string;
  quantityPlanned: number;
  createdBy: string;
}): Promise<OrderDTO> {
  const { itemId, quantityPlanned, createdBy } = params;

  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item) throw new ProductionOrderError("Позиция не найдена");
  if (item.deletedAt) throw new ProductionOrderError("Позиция удалена");

  const bomEntries = await prisma.bomEntry.findMany({
    where: { parentId: itemId },
    include: { child: true },
  });

  if (bomEntries.length === 0) {
    throw new ProductionOrderError("У позиции нет спецификации (BOM)");
  }

  // Находим активную версию BOM для аудита
  const activeBom = await prisma.bom.findFirst({
    where: { itemId, status: "ACTIVE" },
  });

  // Создание без StatusHistory (PLANNED — начальный статус)
  const order = await prisma.productionOrder.create({
    data: {
      itemId,
      itemName: item.name,
      quantityPlanned,
      bomId: activeBom?.id ?? null,
      createdBy,
      snapshotItems: {
        create: bomEntries.map((e) => ({
          itemId: e.childId,
          itemName: e.child.name,
          quantity: toNumber(e.quantity),
        })),
      },
    },
    include: includeSnapshot,
  });

  return mapOrder(order);
}

export async function startOrder(id: string, changedById?: string): Promise<OrderDTO> {
  const updated = await prisma.$transaction(async (tx) => {
    const [order] = await tx.$queryRaw<{ id: string; status: string }[]>`
      SELECT id, status FROM production_orders WHERE id = ${id} FOR UPDATE
    `;
    if (!order) throw new ProductionOrderError("Заказ не найден");
    if (order.status === "IN_PROGRESS") {
      return tx.productionOrder.findUnique({ where: { id }, include: includeSnapshot }).then((o) => o!);
    }
    if (order.status !== "PLANNED") {
      throw new ProductionOrderError("Запустить можно только запланированный заказ");
    }

    await writeStatusHistory(tx, id, "PLANNED", "IN_PROGRESS", changedById);

    return tx.productionOrder.update({
      where: { id },
      data: { status: "IN_PROGRESS", startedAt: new Date() },
      include: includeSnapshot,
    });
  });
  return mapOrder(updated);
}

export async function completeOrder(id: string, workerId: string, changedById?: string): Promise<OrderDTO> {
  const updated = await prisma.$transaction(async (tx) => {
    const [order] = await tx.$queryRaw<{
      id: string;
      status: string;
      item_id: string;
      item_name: string;
      quantity_planned: number;
      quantity_completed: number;
    }[]>`
      SELECT id, status, item_id, item_name, quantity_planned, quantity_completed
      FROM production_orders
      WHERE id = ${id}
      FOR UPDATE
    `;
    if (!order) throw new ProductionOrderError("Заказ не найден");
    if (order.status === "COMPLETED") {
      throw new ServiceError("Заказ уже завершён", 409);
    }
    if (order.status !== "IN_PROGRESS") {
      throw new ProductionOrderError("Завершить можно только заказ в работе");
    }

    const quantityToComplete = order.quantity_planned - order.quantity_completed;
    if (quantityToComplete <= 0) {
      throw new ProductionOrderError("Заказ уже полностью выполнен");
    }

    const snapshotItems = await tx.productionOrderItem.findMany({
      where: { orderId: id },
    });

    // Создаём InventoryOperation
    const opKey = `order-complete-${id}`;
    const existingOp = await tx.inventoryOperation.findUnique({ where: { operationKey: opKey } });
    if (existingOp) {
      // Idempotency
      const existing = await tx.productionOrder.findUnique({
        where: { id },
        include: includeSnapshot,
      });
      return existing!;
    }

    const operation = await tx.inventoryOperation.create({
      data: { operationKey: opKey, type: "ORDER_COMPLETION", createdById: changedById },
    });

    // Собираем все itemId для блокировки (компоненты + изделие)
    const componentIds = snapshotItems.map((si) => si.itemId);
    const allItemIds = [...new Set([...componentIds, order.item_id])].sort();

    // Ensure rows exist, then FOR UPDATE
    for (const itemId of allItemIds) {
      await tx.$queryRaw`
        INSERT INTO stock_balances (item_id, location_id, quantity, updated_at)
        VALUES (${itemId}, ${DEFAULT_LOCATION}, 0, NOW())
        ON CONFLICT (item_id, location_id) DO NOTHING
      `;
    }
    const lockedRows = await tx.$queryRaw<{ item_id: string; quantity: number }[]>`
      SELECT item_id, quantity FROM stock_balances
      WHERE location_id = ${DEFAULT_LOCATION} AND item_id = ANY(${allItemIds})
      ORDER BY item_id ASC
      FOR UPDATE
    `;

    const balanceMap: Record<string, number> = {};
    for (const row of lockedRows) {
      balanceMap[row.item_id] = toNumber(row.quantity);
    }

    // Проверяем остатки
    const shortages: { name: string; needed: number; available: number }[] = [];
    for (const si of snapshotItems) {
      const needed = toNumber(si.quantity) * quantityToComplete;
      const available = balanceMap[si.itemId] ?? 0;
      if (available < needed) {
        shortages.push({
          name: si.itemName,
          needed: Math.round(needed * 1000) / 1000,
          available: Math.round(available * 1000) / 1000,
        });
      }
    }
    if (shortages.length > 0) {
      throw new ProductionOrderError("Недостаточно компонентов", shortages);
    }

    // Списание компонентов
    for (const si of snapshotItems) {
      const needed = toNumber(si.quantity) * quantityToComplete;
      await tx.stockMovement.create({
        data: {
          type: "ASSEMBLY_WRITE_OFF",
          itemId: si.itemId,
          quantity: needed,
          workerId,
          orderId: id,
          operationId: operation.id,
          fromLocationId: DEFAULT_LOCATION,
          toLocationId: "PRODUCTION",
          comment: `Списание по заказу: ${order.item_name} x${quantityToComplete}`,
        },
      });
      await tx.$queryRaw`
        UPDATE stock_balances SET quantity = quantity - ${needed}, updated_at = NOW()
        WHERE item_id = ${si.itemId} AND location_id = ${DEFAULT_LOCATION}
      `;
    }

    // Приход продукции
    await tx.stockMovement.create({
      data: {
        type: "PRODUCTION_INCOME",
        itemId: order.item_id,
        quantity: quantityToComplete,
        workerId,
        orderId: id,
        operationId: operation.id,
        fromLocationId: "PRODUCTION",
        toLocationId: DEFAULT_LOCATION,
        comment: `Выпуск по заказу: ${order.item_name} x${quantityToComplete}`,
      },
    });
    await tx.$queryRaw`
      UPDATE stock_balances SET quantity = quantity + ${quantityToComplete}, updated_at = NOW()
      WHERE item_id = ${order.item_id} AND location_id = ${DEFAULT_LOCATION}
    `;

    await writeStatusHistory(tx, id, "IN_PROGRESS", "COMPLETED", changedById);

    return tx.productionOrder.update({
      where: { id },
      data: {
        status: "COMPLETED",
        quantityCompleted: order.quantity_planned,
        completedAt: new Date(),
      },
      include: includeSnapshot,
    });
  });

  return mapOrder(updated);
}

export async function cancelOrder(id: string, changedById?: string): Promise<OrderDTO> {
  const updated = await prisma.$transaction(async (tx) => {
    const [order] = await tx.$queryRaw<{ id: string; status: string }[]>`
      SELECT id, status FROM production_orders WHERE id = ${id} FOR UPDATE
    `;
    if (!order) throw new ProductionOrderError("Заказ не найден");
    if (order.status === "COMPLETED") {
      throw new ProductionOrderError("Нельзя отменить завершённый заказ");
    }
    if (order.status === "CANCELLED") {
      throw new ProductionOrderError("Заказ уже отменён");
    }

    await writeStatusHistory(
      tx,
      id,
      order.status as OrderStatus,
      "CANCELLED",
      changedById,
    );

    return tx.productionOrder.update({
      where: { id },
      data: { status: "CANCELLED" },
      include: includeSnapshot,
    });
  });
  return mapOrder(updated);
}

export async function deleteOrder(id: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const [order] = await tx.$queryRaw<{ id: string; status: string }[]>`
      SELECT id, status FROM production_orders WHERE id = ${id} FOR UPDATE
    `;
    if (!order) throw new ProductionOrderError("Заказ не найден");
    if (order.status !== "PLANNED") {
      throw new ProductionOrderError("Удалить можно только запланированный заказ");
    }

    // Проверяем что нет истории статусов
    const historyCount = await tx.productionOrderStatusHistory.count({
      where: { orderId: id },
    });
    if (historyCount > 0) {
      throw new ProductionOrderError("Нельзя удалить заказ с историей изменений");
    }

    // Проверяем что нет связанных движений
    const movementCount = await tx.stockMovement.count({
      where: { orderId: id },
    });
    if (movementCount > 0) {
      throw new ProductionOrderError("Нельзя удалить заказ с фактами исполнения");
    }

    await tx.productionOrderItem.deleteMany({ where: { orderId: id } });
    await tx.productionOrder.delete({ where: { id } });
  });
}
