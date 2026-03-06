import type { ItemType, Unit } from "./types";
import { itemTypeLabels, unitLabels, nomenclatureCategories } from "./constants";

export type ItemFormMode = "create" | "edit";

export type FieldType = "text" | "textarea" | "select" | "number";

export interface SelectOption {
  value: string;
  label: string;
}

export interface ItemFieldConfig {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  required?: boolean;
  visible: (mode: ItemFormMode) => boolean;
  editable: (mode: ItemFormMode) => boolean;
  options?: SelectOption[];
  numberProps?: { step?: string; min?: string; width?: string };
  emptyOption?: { value: string; label: string };
}

const typeOptions: SelectOption[] = (["material", "blank", "product"] as ItemType[]).map((t) => ({
  value: t,
  label: itemTypeLabels[t],
}));

const unitOptions: SelectOption[] = (Object.keys(unitLabels) as Unit[]).map((u) => ({
  value: u,
  label: unitLabels[u],
}));

const categoryOptions: SelectOption[] = nomenclatureCategories.map((c) => ({
  value: c.id,
  label: c.name,
}));

export const itemFieldConfig: ItemFieldConfig[] = [
  {
    key: "name",
    label: "Название",
    type: "text",
    placeholder: "Лист стали 3мм",
    required: true,
    visible: () => true,
    editable: () => true,
  },
  {
    key: "description",
    label: "Описание",
    type: "textarea",
    visible: () => true,
    editable: () => true,
  },
  {
    key: "typeId",
    label: "Тип",
    type: "select",
    options: typeOptions,
    visible: () => true,
    editable: () => true,
  },
  {
    key: "unitId",
    label: "Единица",
    type: "select",
    options: unitOptions,
    visible: () => true,
    editable: () => true,
  },
  {
    key: "categoryId",
    label: "Категория",
    type: "select",
    options: categoryOptions,
    emptyOption: { value: "__none__", label: "Без категории" },
    visible: () => true,
    editable: () => true,
  },
  {
    key: "pricePerUnit",
    label: "Расценка, ₽",
    type: "number",
    placeholder: "—",
    numberProps: { step: "0.01", width: "w-28" },
    visible: () => true,
    editable: () => true,
  },
  {
    key: "quantity",
    label: "Количество",
    type: "number",
    placeholder: "0",
    numberProps: { step: "0.01", width: "w-28" },
    visible: (mode) => mode === "create",
    editable: (mode) => mode === "create",
  },
];
