// Типы номенклатуры

export type ItemType = "material" | "blank" | "product";

export const itemTypeLabels: Record<ItemType, string> = {
  material: "Сырьё",
  blank: "Заготовка",
  product: "Изделие",
};

export type Unit = "kg" | "pcs" | "m";

export const unitLabels: Record<Unit, string> = {
  kg: "кг",
  pcs: "шт",
  m: "м",
};

export interface NomenclatureItem {
  id: string;
  name: string;
  type: ItemType;
  unit: Unit;
  category?: string;
  description?: string;
  images?: string[];
  pricePerUnit?: number;
}

export interface BomEntry {
  parentId: string;
  childId: string;
  quantity: number; // сколько единиц child нужно на 1 единицу parent
}

export interface StockMovement {
  id: string;
  type: "SUPPLIER_INCOME" | "PRODUCTION_INCOME" | "ASSEMBLY_WRITE_OFF" | "ASSEMBLY_INCOME" | "ADJUSTMENT_INCOME" | "ADJUSTMENT_WRITE_OFF";
  itemId: string;
  quantity: number;
  date: string;
  workerId?: string;
  comment?: string;
}

// Категории для группировки
export const categories = [
  { id: "body", name: "Кузовные элементы" },
  { id: "suspension", name: "Элементы подвески" },
  { id: "brakes", name: "Тормозная система" },
  { id: "brackets", name: "Кронштейны и крепёж" },
  { id: "shields", name: "Защитные кожухи" },
];

// Данные номенклатуры — пусто (заполняется через интерфейс или seed:demo)
export const bom: BomEntry[] = [];
export const allItems: NomenclatureItem[] = [];
