import { toNumber } from "./serialize";

interface DbItem {
  id: string;
  code: string;
  name: string;
  typeId: string;
  unitId: string;
  categoryId: string | null;
  description: string | null;
  images: string[];
  pricePerUnit: { toNumber(): number } | number | null;
  weight?: { toNumber(): number } | number | null;
  side?: string;
  baseItemId?: string | null;
}

export function mapItem(dbItem: DbItem) {
  return {
    id: dbItem.id,
    code: dbItem.code,
    name: dbItem.name,
    type: dbItem.typeId,
    unit: dbItem.unitId,
    category: dbItem.categoryId,
    description: dbItem.description,
    images: dbItem.images,
    pricePerUnit: toNumber(dbItem.pricePerUnit),
    weight: toNumber(dbItem.weight),
    side: dbItem.side ?? "NONE",
    baseItemId: dbItem.baseItemId ?? null,
  };
}
