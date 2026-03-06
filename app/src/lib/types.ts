// Shared types for the application

// --- Nomenclature ---

export type ItemType = "material" | "blank" | "product";

export type Unit = "kg" | "pcs" | "m";

export interface NomenclatureItem {
  id: string;
  code: string;
  name: string;
  type: ItemType;
  unit: Unit;
  category?: string;
  description?: string;
  images?: string[];
  pricePerUnit?: number;
  isDeleted?: boolean;
}

export interface BomEntry {
  parentId: string;
  childId: string;
  quantity: number;
}

export type MovementType =
  | "SUPPLIER_INCOME"
  | "PRODUCTION_INCOME"
  | "ASSEMBLY_WRITE_OFF"
  | "ASSEMBLY_INCOME"
  | "ADJUSTMENT_INCOME"
  | "ADJUSTMENT_WRITE_OFF";

export interface StockMovement {
  id: string;
  type: MovementType;
  itemId: string;
  quantity: number;
  date: string;
  workerId?: string;
  comment?: string;
}

// --- Workers ---

export type WorkerRole = "WORKER" | "WAREHOUSE" | "DIRECTOR" | "ADMIN";

export type WarehouseRole = Exclude<WorkerRole, "WORKER">;

export interface Worker {
  id: string;
  name: string;
  pin: string;
  role?: WorkerRole;
}

// --- BOM (UI) ---

export interface BomChildEntry {
  item: NomenclatureItem;
  quantity: number;
}
