import { prisma } from "@/lib/prisma";
import type { MovementType } from "@/lib/types";
import { toNumber } from "./helpers/serialize";

const INCOME_TYPES = ["SUPPLIER_INCOME", "PRODUCTION_INCOME", "ASSEMBLY_INCOME", "ADJUSTMENT_INCOME"];

export async function getBalance(itemId: string): Promise<number> {
  const result = await prisma.$queryRaw<[{ balance: number }]>`
    SELECT COALESCE(SUM(
      CASE WHEN type = ANY(${INCOME_TYPES}) THEN quantity ELSE -quantity END
    ), 0) as balance
    FROM stock_movements
    WHERE item_id = ${itemId}
  `;
  return toNumber(result[0].balance);
}

export async function getAllBalances(): Promise<Record<string, number>> {
  const rows = await prisma.$queryRaw<{ item_id: string; balance: number }[]>`
    SELECT item_id, COALESCE(SUM(
      CASE WHEN type = ANY(${INCOME_TYPES}) THEN quantity ELSE -quantity END
    ), 0) as balance
    FROM stock_movements
    GROUP BY item_id
  `;

  const items = await prisma.item.findMany({ select: { id: true } });

  const balances: Record<string, number> = {};
  for (const item of items) {
    balances[item.id] = 0;
  }
  for (const row of rows) {
    balances[row.item_id] = toNumber(row.balance);
  }
  return balances;
}

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
}) {
  return prisma.stockMovement.create({ data });
}

export async function validateItemExists(itemId: string) {
  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item) return null;
  return item;
}
