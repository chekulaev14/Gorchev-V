"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ItemType } from "@/lib/types";
import { unitLabels } from "@/lib/constants";
import type { ConstructorItem, ProductData } from "./wizard-reducer";
import { ComponentsSection } from "./ComponentsSection";

interface ProductStepProps {
  product: ProductData;
  onProductChange: (product: ProductData) => void;
  productTempId: string;
  isPaired: boolean;
  onPairedChange: (v: boolean) => void;
  getAvailableComponents: () => (ConstructorItem & { type: ItemType })[];
  getComponentsOf: (parentTempId: string) => (ConstructorItem & { type: ItemType })[];
  onAttach: (componentTempId: string, parentTempId: string) => void;
  onDetach: (componentTempId: string) => void;
  onUpdateQuantity: (componentTempId: string, quantity: string) => void;
}

export function ProductStep({
  product,
  onProductChange,
  productTempId,
  isPaired,
  onPairedChange,
  getAvailableComponents,
  getComponentsOf,
  onAttach,
  onDetach,
  onUpdateQuantity,
}: ProductStepProps) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-foreground mb-1">Изделие</p>
        <p className="text-xs text-muted-foreground">Заполните информацию об изделии и выберите компоненты</p>
      </div>

      <div className="rounded-lg border border-border bg-card p-3 space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="text-xs text-muted-foreground mb-1 block">Название *</label>
            <Input
              value={product.name}
              onChange={(e) => onProductChange({ ...product, name: e.target.value })}
              placeholder={isPaired ? "Базовое название (без лев/прав)" : "Например: Кронштейн"}
              className="h-9 text-sm"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPaired}
                onChange={(e) => onPairedChange(e.target.checked)}
                className="rounded border-border"
              />
              <span className="text-xs text-foreground">Парная деталь (левая / правая)</span>
            </label>
            {isPaired && (
              <p className="text-[11px] text-muted-foreground mt-1 ml-5">
                Будет создано 2 изделия: &laquo;{product.name || "..."} (Л)&raquo; и &laquo;{product.name || "..."} (П)&raquo;. Парные заготовки тоже продублируются.
              </p>
            )}
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Единица измерения</label>
            <Select value={product.unit} onValueChange={(v) => onProductChange({ ...product, unit: v })}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(unitLabels).map(([k, v]) => (
                  <SelectItem key={k} value={k} className="text-sm">
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Вес, кг</label>
            <Input
              type="number"
              step="0.001"
              value={product.weight}
              onChange={(e) => onProductChange({ ...product, weight: e.target.value })}
              placeholder="—"
              className="h-9 text-sm w-28"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Описание</label>
            <Input
              value={product.description}
              onChange={(e) => onProductChange({ ...product, description: e.target.value })}
              placeholder="Краткое описание изделия"
              className="h-9 text-sm"
            />
          </div>
        </div>

        <ComponentsSection
          parentTempId={productTempId}
          componentsFrom="предыдущих шагов"
          getAvailableComponents={getAvailableComponents}
          getComponentsOf={getComponentsOf}
          onAttach={onAttach}
          onDetach={onDetach}
          onUpdateQuantity={onUpdateQuantity}
        />
      </div>
    </div>
  );
}
