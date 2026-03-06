import type { ItemType } from "@/lib/types";

// --- Типы ---

export interface ConstructorItem {
  tempId: string;
  existingId?: string;
  name: string;
  unit: string;
  description: string;
  pricePerUnit: string;
  quantity: string;
  stockQuantity: string;
  parentTempId: string;
  isPaired: boolean;
}

export interface ProductData {
  name: string;
  unit: string;
  description: string;
}

export interface DbItem {
  id: string;
  name: string;
  type: string;
  unit: string;
  category: string | null;
  description: string | null;
  pricePerUnit: number | null;
}

export interface WizardState {
  step: number;
  materials: ConstructorItem[];
  blanks: ConstructorItem[];
  product: ProductData;
  isPaired: boolean;
}

// --- Actions ---

export type WizardAction =
  | { type: "SET_STEP"; step: number }
  | { type: "ADD_ITEM"; stepIndex: number }
  | { type: "REMOVE_ITEM"; stepIndex: number; tempId: string }
  | { type: "UPDATE_ITEM"; stepIndex: number; tempId: string; field: keyof ConstructorItem; value: string | boolean }
  | { type: "SELECT_EXISTING"; stepIndex: number; tempId: string; dbItem: DbItem }
  | { type: "CLEAR_EXISTING"; stepIndex: number; tempId: string }
  | { type: "SET_PRODUCT"; product: ProductData }
  | { type: "TOGGLE_PAIRED"; isPaired: boolean }
  | { type: "ATTACH_COMPONENT"; componentTempId: string; parentTempId: string }
  | { type: "DETACH_COMPONENT"; componentTempId: string }
  | { type: "UPDATE_QUANTITY"; componentTempId: string; quantity: string };

// --- Helpers ---

let tempIdCounter = 0;
export function nextTempId() {
  return `temp-${Date.now()}-${++tempIdCounter}`;
}

function newItem(): ConstructorItem {
  return {
    tempId: nextTempId(),
    name: "",
    unit: "pcs",
    description: "",
    pricePerUnit: "",
    quantity: "1",
    stockQuantity: "",
    parentTempId: "",
    isPaired: false,
  };
}

function syncPaired(blanks: ConstructorItem[]): boolean {
  return blanks.some((b) => b.isPaired);
}


function updateListByStep(
  state: WizardState,
  stepIndex: number,
  updater: (items: ConstructorItem[]) => ConstructorItem[]
): WizardState {
  if (stepIndex === 0) {
    return { ...state, materials: updater(state.materials) };
  }
  if (stepIndex === 1) {
    const blanks = updater(state.blanks);
    return { ...state, blanks, isPaired: syncPaired(blanks) };
  }
  return state;
}

function updateItemInAllLists(
  state: WizardState,
  tempId: string,
  updater: (item: ConstructorItem) => ConstructorItem
): WizardState {
  const inMaterials = state.materials.some((i) => i.tempId === tempId);
  if (inMaterials) {
    return { ...state, materials: state.materials.map((i) => (i.tempId === tempId ? updater(i) : i)) };
  }
  const inBlanks = state.blanks.some((i) => i.tempId === tempId);
  if (inBlanks) {
    const blanks = state.blanks.map((i) => (i.tempId === tempId ? updater(i) : i));
    return { ...state, blanks, isPaired: syncPaired(blanks) };
  }
  return state;
}

function detachChildrenOf(state: WizardState, parentTempId: string): WizardState {
  const detach = (items: ConstructorItem[]) =>
    items.map((i) => (i.parentTempId === parentTempId ? { ...i, parentTempId: "" } : i));
  return { ...state, materials: detach(state.materials), blanks: detach(state.blanks) };
}

// --- Reducer ---

export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, step: action.step };

    case "ADD_ITEM":
      return updateListByStep(state, action.stepIndex, (items) => [newItem(), ...items]);

    case "REMOVE_ITEM": {
      const cleaned = detachChildrenOf(state, action.tempId);
      return updateListByStep(cleaned, action.stepIndex, (items) =>
        items.filter((i) => i.tempId !== action.tempId)
      );
    }

    case "UPDATE_ITEM":
      return updateListByStep(state, action.stepIndex, (items) =>
        items.map((i) => (i.tempId === action.tempId ? { ...i, [action.field]: action.value } : i))
      );

    case "SELECT_EXISTING": {
      const { dbItem } = action;
      return updateListByStep(state, action.stepIndex, (items) =>
        items.map((i) =>
          i.tempId === action.tempId
            ? {
                ...i,
                existingId: dbItem.id,
                name: dbItem.name,
                unit: dbItem.unit,
                description: dbItem.description || "",
                pricePerUnit: dbItem.pricePerUnit?.toString() || "",
              }
            : i
        )
      );
    }

    case "CLEAR_EXISTING":
      return updateListByStep(state, action.stepIndex, (items) =>
        items.map((i) =>
          i.tempId === action.tempId
            ? { ...i, existingId: undefined, name: "", unit: "pcs", description: "", pricePerUnit: "", stockQuantity: "", isPaired: false }
            : i
        )
      );

    case "SET_PRODUCT":
      return { ...state, product: action.product };

    case "TOGGLE_PAIRED":
      return { ...state, isPaired: action.isPaired };

    case "ATTACH_COMPONENT":
      return updateItemInAllLists(state, action.componentTempId, (i) => ({
        ...i,
        parentTempId: action.parentTempId,
      }));

    case "DETACH_COMPONENT":
      return updateItemInAllLists(state, action.componentTempId, (i) => ({
        ...i,
        parentTempId: "",
      }));

    case "UPDATE_QUANTITY":
      return updateItemInAllLists(state, action.componentTempId, (i) => ({
        ...i,
        quantity: action.quantity,
      }));

    default:
      return state;
  }
}

// --- Initial state ---

export function createInitialState(): WizardState {
  return {
    step: 0,
    materials: [],
    blanks: [],
    product: { name: "", unit: "pcs", description: "" },
    isPaired: false,
  };
}

// --- Селекторы ---

export function getAvailableComponents(
  state: WizardState,
  stepIndex: number,
  excludeTempId?: string
): (ConstructorItem & { type: ItemType })[] {
  const result: (ConstructorItem & { type: ItemType })[] = [];
  const allStepItems: [ConstructorItem[], ItemType][] = [
    [state.materials, "material"],
    [state.blanks, "blank"],
  ];

  for (let i = 0; i <= stepIndex && i < allStepItems.length; i++) {
    const [items, type] = allStepItems[i];
    items
      .filter((item) => item.name.trim() && item.tempId !== excludeTempId)
      .forEach((item) => result.push({ ...item, type }));
  }
  return result;
}

export function getComponentsOf(
  state: WizardState,
  parentTempId: string
): (ConstructorItem & { type: ItemType })[] {
  const all: [ConstructorItem[], ItemType][] = [
    [state.materials, "material"],
    [state.blanks, "blank"],
  ];
  const result: (ConstructorItem & { type: ItemType })[] = [];
  for (const [items, type] of all) {
    items
      .filter((i) => i.parentTempId === parentTempId && i.name.trim())
      .forEach((i) => result.push({ ...i, type }));
  }
  return result;
}

export function canGoNext(state: WizardState): boolean {
  if (state.step >= 0 && state.step <= 1) return true;
  if (state.step === 2) return state.product.name.trim().length > 0;
  return true;
}

export function canFinish(state: WizardState): boolean {
  return state.product.name.trim().length > 0;
}

// --- Шаги ---

export const STEPS: { type: ItemType; label: string; componentsFrom: string }[] = [
  { type: "material", label: "Сырье", componentsFrom: "" },
  { type: "blank", label: "Заготовки", componentsFrom: "сырья и заготовок" },
  { type: "product", label: "Изделие", componentsFrom: "заготовок и сырья" },
];
