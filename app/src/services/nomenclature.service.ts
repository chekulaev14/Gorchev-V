import { prisma } from "@/lib/prisma";
import { mapItem } from "./helpers/map-item";

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
}) {
  const typeId = data.typeId || "material";
  const code = data.code || (await generateCode(typeId));
  const created = await prisma.item.create({
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
    },
  });
  return mapItem(created);
}

const CODE_PREFIXES: Record<string, string> = {
  material: "MAT",
  blank: "BLK",
  product: "PRD",
};

async function generateCode(typeId: string): Promise<string> {
  const prefix = CODE_PREFIXES[typeId] || "ITM";
  const pattern = `${prefix}-%`;
  const result = await prisma.$queryRaw<[{ max_num: number | null }]>`
    SELECT MAX(
      CAST(SUBSTRING(code FROM ${prefix.length + 2}) AS INTEGER)
    ) as max_num
    FROM items
    WHERE code LIKE ${pattern}
  `;
  const next = (result[0].max_num ?? 0) + 1;
  return `${prefix}-${String(next).padStart(3, "0")}`;
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

  if (movementsCount > 0 || logsCount > 0) {
    const reasons: string[] = [];
    if (movementsCount > 0) reasons.push(`складских движений: ${movementsCount}`);
    if (logsCount > 0) reasons.push(`записей выработки: ${logsCount}`);
    throw new Error(`Нельзя удалить позицию — есть связанные данные (${reasons.join(", ")})`);
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

