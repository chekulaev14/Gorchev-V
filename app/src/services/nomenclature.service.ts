import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/lib/api/handle-route-error";
import { mapItem } from "./helpers/map-item";
import { getNextCode, toCodeKind } from "./helpers/code-generator";

interface ItemFilters {
  type?: string;
  category?: string;
  search?: string;
  deleted?: boolean;
}

export async function getItems(filters: ItemFilters) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (filters.deleted) {
    where.deletedAt = { not: null };
  } else {
    where.deletedAt = null;
  }

  if (filters.type) where.typeId = filters.type;
  if (filters.category) where.categoryId = filters.category;
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { code: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const [items, categories] = await Promise.all([
    prisma.item.findMany({
      where,
      include: { type: true },
      orderBy: [{ type: { order: "asc" } }, { name: "asc" }],
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  return { items: items.map(mapItem), categories };
}

export async function createItem(data: {
  name: string;
  code?: string;
  typeId?: string;
  unitId?: string;
  categoryId?: string | null;
  description?: string | null;
  pricePerUnit?: number | null;
  weight?: number | null;
}) {
  const typeId = data.typeId || "material";

  const created = await prisma.$transaction(async (tx) => {
    const code = data.code || await getNextCode(tx, toCodeKind(typeId));
    return tx.item.create({
      data: {
        id: crypto.randomUUID(),
        code,
        name: data.name,
        typeId,
        unitId: data.unitId || "pcs",
        categoryId: data.categoryId || null,
        description: data.description || null,
        images: [],
        pricePerUnit: data.pricePerUnit ?? null,
        weight: data.weight ?? null,
      },
    });
  });
  return mapItem(created);
}


export async function updateItem(id: string, data: Record<string, unknown>) {
  const updated = await prisma.item.update({
    where: { id },
    data,
    include: { type: true },
  });
  return mapItem(updated);
}

export async function softDelete(id: string) {
  const [movementsCount, logsCount] = await Promise.all([
    prisma.stockMovement.count({ where: { itemId: id } }),
    prisma.productionLog.count({ where: { itemId: id } }),
  ]);

  if (logsCount > 0) {
    throw new ServiceError(
      `Нельзя удалить — есть записи выработки: ${logsCount}`,
      400,
    );
  }

  // Если есть только складские движения — откатить их и удалить баланс
  if (movementsCount > 0) {
    await prisma.$transaction(async (tx) => {
      // Удаляем складские движения и связанные операции
      const movements = await tx.stockMovement.findMany({
        where: { itemId: id },
        select: { operationId: true },
      });
      const operationIds = [
        ...new Set(movements.map((m) => m.operationId).filter(Boolean)),
      ] as string[];

      await tx.stockMovement.deleteMany({ where: { itemId: id } });
      await tx.stockBalance.deleteMany({ where: { itemId: id } });

      if (operationIds.length > 0) {
        // Удаляем операции только если у них не осталось других движений
        for (const opId of operationIds) {
          const remaining = await tx.stockMovement.count({ where: { operationId: opId } });
          if (remaining === 0) {
            await tx.inventoryOperation.delete({ where: { id: opId } });
          }
        }
      }

      await tx.item.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    });
    return;
  }

  await prisma.item.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

export async function restore(id: string) {
  await prisma.item.update({
    where: { id },
    data: { deletedAt: null },
  });
}

