"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { itemFieldConfig, type ItemFormMode } from "@/lib/item-field-config";

export interface ItemFormValues {
  [key: string]: string;
  name: string;
  description: string;
  typeId: string;
  unitId: string;
  categoryId: string;
  pricePerUnit: string;
  quantity: string;
}

interface Props {
  mode: ItemFormMode;
  values: ItemFormValues;
  onChange: (values: ItemFormValues) => void;
  onSubmit: () => void;
  onCancel: () => void;
  saving: boolean;
  title?: string;
}

export const emptyItemFormValues: ItemFormValues = {
  name: "",
  description: "",
  typeId: "material",
  unitId: "pcs",
  categoryId: "",
  pricePerUnit: "",
  quantity: "",
};

export function itemFormValuesFromItem(item: {
  name: string;
  description?: string | null;
  type: string;
  unit: string;
  category?: string | null;
  pricePerUnit?: number | null;
}): ItemFormValues {
  return {
    name: item.name,
    description: item.description || "",
    typeId: item.type,
    unitId: item.unit,
    categoryId: item.category || "",
    pricePerUnit: item.pricePerUnit?.toString() || "",
    quantity: "",
  };
}

export function ItemForm({ mode, values, onChange, onSubmit, onCancel, saving, title }: Props) {
  const visibleFields = itemFieldConfig.filter((f) => f.visible(mode));

  const inlineFields = visibleFields.filter((f) => f.type === "select" || f.type === "number");
  const blockFields = visibleFields.filter((f) => f.type === "text" || f.type === "textarea");

  const updateField = (key: string, value: string) => {
    onChange({ ...values, [key]: value });
  };

  const submitLabel = mode === "create" ? "Создать" : "Сохранить";
  const savingLabel = mode === "create" ? "Создание..." : "Сохранение...";

  return (
    <div className="bg-card rounded-lg border border-border p-4 space-y-3">
      {title && <p className="text-foreground text-sm font-medium">{title}</p>}

      {blockFields.map((field) => (
        <div key={field.key}>
          <label className="text-muted-foreground text-xs block mb-1">{field.label}</label>
          {field.type === "text" && (
            <Input
              value={values[field.key] || ""}
              onChange={(e) => updateField(field.key, e.target.value)}
              className="h-9 text-sm"
              placeholder={field.placeholder}
            />
          )}
          {field.type === "textarea" && (
            <textarea
              value={values[field.key] || ""}
              onChange={(e) => updateField(field.key, e.target.value)}
              className="w-full bg-card border border-border text-foreground text-sm rounded px-3 py-2 min-h-[60px] resize-y"
            />
          )}
        </div>
      ))}

      <div className="flex flex-wrap gap-3">
        {inlineFields.map((field) => (
          <div key={field.key}>
            <label className="text-muted-foreground text-xs block mb-1">{field.label}</label>
            {field.type === "select" && field.options && (
              <Select
                value={getSelectValue(field, values)}
                onValueChange={(v) => updateField(field.key, field.emptyOption && v === field.emptyOption.value ? "" : v)}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {field.emptyOption && (
                    <SelectItem value={field.emptyOption.value}>{field.emptyOption.label}</SelectItem>
                  )}
                  {field.options.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {field.type === "number" && (
              <Input
                type="number"
                step={field.numberProps?.step}
                min={field.numberProps?.min}
                value={values[field.key] || ""}
                onChange={(e) => updateField(field.key, e.target.value)}
                className={`h-9 text-sm ${field.numberProps?.width || ""}`}
                placeholder={field.placeholder}
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2 pt-1">
        <Button size="sm" className="h-8 text-xs" onClick={onSubmit} disabled={saving || !values.name.trim()}>
          {saving ? savingLabel : submitLabel}
        </Button>
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onCancel} disabled={saving}>
          Отмена
        </Button>
      </div>
    </div>
  );
}

function getSelectValue(field: { key: string; emptyOption?: { value: string } }, values: ItemFormValues): string {
  const val = values[field.key] || "";
  if (!val && field.emptyOption) return field.emptyOption.value;
  return val;
}
