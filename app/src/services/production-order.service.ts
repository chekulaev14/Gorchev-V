import { prisma } from "@/lib/prisma";
import { toNumber } from "./helpers/serialize";

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

  const order = await prisma.productionOrder.create({
    data: {
      itemId,
      itemName: item.name,
      quantityPlanned,
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

export async function startOrder(id: string): Promise<OrderDTO> {
  const updated = await prisma.$transaction(async (tx) => {
    const [order] = await tx.$queryRaw<{ id: string; status: string }[]>`
      SELECT id, status FROM production_orders WHERE id = ${id} FOR UPDATE
    `;
    if (!order) throw new ProductionOrderError("Заказ не найден");
    if (order.status === "IN_PROGRESS") {
      // Idempotency
      return tx.productionOrder.findUnique({ where: { id }, include: includeSnapshot }).then((o) => o!);
    }
    if (order.status !== "PLANNED") {
      throw new ProductionOrderError("Запустить можно только запланированный заказ");
    }

    return tx.productionOrder.update({
      where: { id },
      data: { status: "IN_PROGRESS", startedAt: new Date() },
      include: includeSnapshot,
    });
  });
  return mapOrder(updated);
}

export async function completeOrder(id: string, workerId: string): Promise<OrderDTO> {
  const INCOME_TYPES = ["SUPPLIER_INCOME", "PRODUCTION_INCOME", "ASSEMBLY_INCOME", "ADJUSTMENT_INCOME"];

  const updated = await prisma.$transaction(async (tx) => {
    // Блокируем заказ (SELECT FOR UPDATE) для защиты от параллельных вызовов
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
      // Idempotency: уже завершён — вернуть как есть
      const existing = await tx.productionOrder.findUnique({
        where: { id },
        include: includeSnapshot,
      });
      return existing!;
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

    // Проверяем остатки ВНУТРИ транзакции
    const shortages: { name: string; needed: number; available: number }[] = [];
    for (const si of snapshotItems) {
      const needed = toNumber(si.quantity) * quantityToComplete;
      const [{ balance }] = await tx.$queryRaw<[{ balance: number }]>`
        SELECT COALESCE(SUM(
          CASE WHEN type = ANY(${INCOME_TYPES}) THEN quantity ELSE -quantity END
        ), 0) as balance
        FROM stock_movements
        WHERE item_id = ${si.itemId}
      `;
      const available = toNumber(balance);
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
          comment: `Списание по заказу: ${order.item_name} x${quantityToComplete}`,
        },
      });
    }

    // Приход продукции
    await tx.stockMovement.create({
      data: {
        type: "PRODUCTION_INCOME",
        itemId: order.item_id,
        quantity: quantityToComplete,
        workerId,
        orderId: id,
        comment: `Выпуск по заказу: ${order.item_name} x${quantityToComplete}`,
      },
    });

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

export async function cancelOrder(id: string): Promise<OrderDTO> {
  const order = await prisma.productionOrder.findUnique({ where: { id } });
  if (!order) throw new ProductionOrderError("Заказ не найден");
  if (order.status === "COMPLETED") {
    throw new ProductionOrderError("Нельзя отменить завершённый заказ");
  }
  if (order.status === "CANCELLED") {
    throw new ProductionOrderError("Заказ уже отменён");
  }

  const updated = await prisma.productionOrder.update({
    where: { id },
    data: { status: "CANCELLED" },
    include: includeSnapshot,
  });
  return mapOrder(updated);
}
