"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TreePreview } from "./TreePreview";
import type { ItemType } from "@/lib/types";
import { itemTypeLabels, unitLabels, typeColors } from "@/lib/constants";

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

interface ProductData {
  name: string;
  unit: string;
  description: string;
}

interface DbItem {
  id: string;
  name: string;
  type: string;
  unit: string;
  category: string | null;
  description: string | null;
  pricePerUnit: number | null;
}

const typeOrder: ItemType[] = ["material", "blank", "product"];

// Шаги: от сырья к изделию
const STEPS: { type: ItemType; label: string; componentsFrom: string }[] = [
  { type: "material", label: "Сырье", componentsFrom: "" },
  { type: "blank", label: "Заготовки", componentsFrom: "сырья и заготовок" },
  { type: "product", label: "Изделие", componentsFrom: "заготовок и сырья" },
];

let tempIdCounter = 0;
function nextTempId() {
  return `temp-${Date.now()}-${++tempIdCounter}`;
}

export function ConstructorWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [creating, setCreating] = useState(false);

  const [materials, setMaterials] = useState<ConstructorItem[]>([]);
  const [blanks, setBlanks] = useState<ConstructorItem[]>([]);

  const [product, setProduct] = useState<ProductData>({
    name: "",
    unit: "pcs",
    description: "",
  });
  const [isPairedProduct, setIsPairedProduct] = useState(false);
  const [productTempId] = useState(() => nextTempId());

  // Автоматически включать/выключать парность изделия по наличию парных заготовок
  useEffect(() => {
    const hasPairedBlanks = blanks.some((b) => b.isPaired);
    setIsPairedProduct(hasPairedBlanks);
  }, [blanks]);

  // Массивы по индексу шага (0-1 — items, 2 — product)
  const itemsByStep = [materials, blanks, null];
  const settersByStep = [setMaterials, setBlanks, null];

  // Получить все доступные компоненты (из текущего и всех предыдущих шагов)
  // excludeTempId — исключить саму позицию (чтобы не привязать к себе)
  const getAvailableComponents = useCallback(
    (stepIndex: number, excludeTempId?: string): (ConstructorItem & { type: ItemType })[] => {
      const result: (ConstructorItem & { type: ItemType })[] = [];
      const allStepItems: [ConstructorItem[], ItemType][] = [
        [materials, "material"],
        [blanks, "blank"],
      ];

      // Включаем текущий шаг и все предыдущие
      for (let i = 0; i <= stepIndex && i < allStepItems.length; i++) {
        const [items, type] = allStepItems[i];
        items
          .filter((item) => item.name.trim() && item.tempId !== excludeTempId)
          .forEach((item) => result.push({ ...item, type }));
      }
      return result;
    },
    [materials, blanks]
  );

  // Получить компоненты привязанные к конкретному parent
  const getComponentsOf = useCallback(
    (parentTempId: string): (ConstructorItem & { type: ItemType })[] => {
      const all: [ConstructorItem[], ItemType][] = [
        [materials, "material"],
        [blanks, "blank"],
      ];
      const result: (ConstructorItem & { type: ItemType })[] = [];
      for (const [items, type] of all) {
        items
          .filter((i) => i.parentTempId === parentTempId && i.name.trim())
          .forEach((i) => result.push({ ...i, type }));
      }
      return result;
    },
    [materials, blanks]
  );

  // Привязать компонент к parent
  const attachComponent = useCallback(
    (componentTempId: string, parentTempId: string) => {
      const allSetters: [ConstructorItem[], React.Dispatch<React.SetStateAction<ConstructorItem[]>>][] = [
        [materials, setMaterials],
        [blanks, setBlanks],
      ];
      for (const [items, setter] of allSetters) {
        if (items.some((i) => i.tempId === componentTempId)) {
          setter((prev) =>
            prev.map((i) =>
              i.tempId === componentTempId ? { ...i, parentTempId: parentTempId } : i
            )
          );
          break;
        }
      }
    },
    [materials, blanks]
  );

  // Отвязать компонент от parent
  const detachComponent = useCallback(
    (componentTempId: string) => {
      attachComponent(componentTempId, "");
    },
    [attachComponent]
  );

  // Обновить quantity у компонента
  const updateComponentQuantity = useCallback(
    (componentTempId: string, quantity: string) => {
      const allSetters: [ConstructorItem[], React.Dispatch<React.SetStateAction<ConstructorItem[]>>][] = [
        [materials, setMaterials],
        [blanks, setBlanks],
      ];
      for (const [items, setter] of allSetters) {
        if (items.some((i) => i.tempId === componentTempId)) {
          setter((prev) =>
            prev.map((i) =>
              i.tempId === componentTempId ? { ...i, quantity } : i
            )
          );
          break;
        }
      }
    },
    [materials, blanks]
  );

  const addItem = (stepIndex: number) => {
    const newItem: ConstructorItem = {
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
    const setter = settersByStep[stepIndex];
    if (setter) setter((prev) => [newItem, ...prev]);
  };

  const updateItem = (stepIndex: number, tempId: string, field: keyof ConstructorItem, value: string | boolean) => {
    const setter = settersByStep[stepIndex];
    if (setter) {
      setter((prev) =>
        prev.map((item) => (item.tempId === tempId ? { ...item, [field]: value } : item))
      );
    }
  };

  const selectExistingItem = (stepIndex: number, tempId: string, dbItem: DbItem) => {
    const setter = settersByStep[stepIndex];
    if (setter) {
      setter((prev) =>
        prev.map((item) =>
          item.tempId === tempId
            ? {
                ...item,
                existingId: dbItem.id,
                name: dbItem.name,
                unit: dbItem.unit,
                description: dbItem.description || "",
                pricePerUnit: dbItem.pricePerUnit?.toString() || "",
              }
            : item
        )
      );
    }
  };

  const clearExistingItem = (stepIndex: number, tempId: string) => {
    const setter = settersByStep[stepIndex];
    if (setter) {
      setter((prev) =>
        prev.map((item) =>
          item.tempId === tempId
            ? { ...item, existingId: undefined, name: "", unit: "pcs", description: "", pricePerUnit: "", stockQuantity: "", isPaired: false }
            : item
        )
      );
    }
  };

  const removeItem = (stepIndex: number, tempId: string) => {
    // Отвязать все компоненты привязанные к этому элементу
    const allSetters = [setMaterials, setBlanks];
    allSetters.forEach((setter) => {
      setter((prev) =>
        prev.map((i) => (i.parentTempId === tempId ? { ...i, parentTempId: "" } : i))
      );
    });
    const setter = settersByStep[stepIndex];
    if (setter) setter((prev) => prev.filter((item) => item.tempId !== tempId));
  };

  const canGoNext = () => {
    if (step >= 0 && step <= 1) {
      return true; // шаги с items — можно пропустить
    }
    if (step === 2) {
      return product.name.trim().length > 0;
    }
    return true;
  };

  const handleCreate = async () => {
    setCreating(true);

    const allComponents = [
      ...materials.filter((i) => i.name.trim()),
      ...blanks.filter((i) => i.name.trim()),
    ];

    const typeMap = new Map<string, ItemType>();
    materials.forEach((i) => typeMap.set(i.tempId, "material"));
    blanks.forEach((i) => typeMap.set(i.tempId, "blank"));

    const payload = {
      product: {
        name: product.name,
        unit: product.unit,
        description: product.description,
      },
      isPaired: isPairedProduct,
      components: allComponents.map((c) => ({
        tempId: c.tempId,
        parentTempId: c.parentTempId === productTempId || !c.parentTempId ? "product" : c.parentTempId,
        existingId: c.existingId,
        name: c.name,
        type: typeMap.get(c.tempId) || "material",
        unit: c.unit,
        description: c.description || undefined,
        pricePerUnit: c.pricePerUnit ? Number(c.pricePerUnit) : undefined,
        quantity: Number(c.quantity) || 1,
        isPaired: c.isPaired,
      })),
    };

    try {
      await api.post("/api/product-create", payload);
      toast.success("Изделие создано");
      router.push("/warehouse");
    } catch {
      // toast shown by api-client
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Stepper */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {STEPS.map((s, i) => (
          <div key={s.type} className="flex items-center">
            <button
              onClick={() => (i <= step || step === 3) && setStep(i)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs whitespace-nowrap transition-colors ${
                i === step
                  ? "bg-foreground text-background font-medium"
                  : i < step
                  ? "bg-accent text-foreground cursor-pointer"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium ${
                i < step
                  ? "bg-emerald-500 text-white"
                  : i === step
                  ? "bg-background text-foreground"
                  : "bg-muted-foreground/30 text-muted-foreground"
              }`}>
                {i < step ? "✓" : i + 1}
              </span>
              {s.label}
            </button>
            {i < STEPS.length - 1 && (
              <div className={`w-4 h-px mx-0.5 ${i < step ? "bg-emerald-500" : "bg-border"}`} />
            )}
          </div>
        ))}
        <div className="flex items-center">
          <div className={`w-4 h-px mx-0.5 ${step === 3 ? "bg-emerald-500" : "bg-border"}`} />
          <button
            onClick={() => step === 3 && setStep(3)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs whitespace-nowrap transition-colors ${
              step === 3
                ? "bg-foreground text-background font-medium"
                : "bg-muted text-muted-foreground"
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium ${
              step === 3 ? "bg-background text-foreground" : "bg-muted-foreground/30 text-muted-foreground"
            }`}>
              4
            </span>
            Итог
          </button>
        </div>
      </div>

      {/* Навигация */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => router.push("/warehouse")}
          >
            Отмена
          </Button>
          {step > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setStep(step - 1)}
            >
              Назад
            </Button>
          )}
        </div>

        <div className="flex gap-2">
          {step >= 0 && step <= 1 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground"
              onClick={() => setStep(step + 1)}
            >
              Пропустить
            </Button>
          )}

          {step < 3 && (
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={() => setStep(step + 1)}
              disabled={!canGoNext()}
            >
              Далее
            </Button>
          )}

          {step === 3 && (
            <Button
              size="sm"
              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleCreate}
              disabled={creating}
            >
              {creating ? "Создание..." : "Создать изделие"}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          {/* Шаги 0-1: Сырье, Заготовки */}
          {step >= 0 && step <= 1 && (
            <ItemsStep
              step={step}
              stepInfo={STEPS[step]}
              items={itemsByStep[step]!}
              typeColors={typeColors}
              onAdd={() => addItem(step)}
              onUpdate={(tempId, field, value) => updateItem(step, tempId, field, value)}
              onSelectExisting={(tempId, dbItem) => selectExistingItem(step, tempId, dbItem)}
              onClearExisting={(tempId) => clearExistingItem(step, tempId)}
              onRemove={(tempId) => removeItem(step, tempId)}
              getAvailableComponents={(excludeTempId) => getAvailableComponents(step, excludeTempId)}
              getComponentsOf={getComponentsOf}
              onAttach={attachComponent}
              onDetach={detachComponent}
              onUpdateQuantity={updateComponentQuantity}
            />
          )}

          {/* Шаг 2: Изделие */}
          {step === 2 && (
            <ProductStep
              product={product}
              setProduct={setProduct}
              productTempId={productTempId}
              isPaired={isPairedProduct}
              setIsPaired={setIsPairedProduct}
              getAvailableComponents={() => getAvailableComponents(2, undefined)}
              getComponentsOf={getComponentsOf}
              onAttach={attachComponent}
              onDetach={detachComponent}
              onUpdateQuantity={updateComponentQuantity}
            />
          )}

          {step === 3 && (
            <SummaryStep
              product={product}
              productTempId={productTempId}
              blanks={blanks}
              materials={materials}
              typeColors={typeColors}
              isPaired={isPairedProduct}
            />
          )}
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-4">
            <p className="text-xs text-muted-foreground mb-2 font-medium">Структура изделия</p>
            <div className="rounded-lg border border-border bg-card p-3">
              <TreePreview
                product={product}
                productTempId={productTempId}
                blanks={blanks}
                materials={materials}
                isPaired={isPairedProduct}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Поиск по базе ---

function useDbSearch() {
  const [query, setQuery] = useState("");
  const [allItems, setAllItems] = useState<DbItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (loaded) return;
    setLoading(true);
    try {
      const data = await api.get<{ items: DbItem[] }>("/api/nomenclature", { silent: true });
      const sorted = (data.items || []).sort((a: DbItem, b: DbItem) =>
        a.name.localeCompare(b.name, "ru")
      );
      setAllItems(sorted);
      setLoaded(true);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [loaded]);

  const isSearching = query.trim().length > 0;

  const filtered = isSearching
    ? allItems.filter((item) =>
        item.name.toLowerCase().includes(query.toLowerCase())
      )
    : allItems;

  const grouped = isSearching
    ? null
    : (() => {
        const byType = new Map<string, DbItem[]>();
        filtered.forEach((item) => {
          if (!byType.has(item.type)) byType.set(item.type, []);
          byType.get(item.type)!.push(item);
        });

        const groups: { type: ItemType; label: string; items: DbItem[] }[] = [];
        typeOrder.forEach((t) => {
          const items = byType.get(t);
          if (items && items.length > 0) {
            groups.push({ type: t, label: itemTypeLabels[t], items });
          }
        });
        return groups;
      })();

  return { query, setQuery, filtered, grouped, isSearching, loading, load };
}

// --- Секция компонентов ---

function ComponentsSection({
  parentTempId,
  componentsFrom,
  getAvailableComponents,
  getComponentsOf,
  onAttach,
  onDetach,
  onUpdateQuantity,
}: {
  parentTempId: string;
  componentsFrom: string;
  getAvailableComponents: () => (ConstructorItem & { type: ItemType })[];
  getComponentsOf: (parentTempId: string) => (ConstructorItem & { type: ItemType })[];
  onAttach: (componentTempId: string, parentTempId: string) => void;
  onDetach: (componentTempId: string) => void;
  onUpdateQuantity: (componentTempId: string, quantity: string) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);

  const attached = getComponentsOf(parentTempId);
  const available = getAvailableComponents().filter(
    (c) => c.parentTempId === "" || c.parentTempId === parentTempId
  );
  const unattached = available.filter((c) => c.parentTempId !== parentTempId);

  return (
    <div className="border-t border-border pt-2 mt-2">
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs text-muted-foreground font-medium">
          Компоненты (из {componentsFrom})
        </label>
        {unattached.length > 0 && (
          <button
            onClick={() => setShowPicker(!showPicker)}
            className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
          >
            {showPicker ? "Скрыть" : "+ Добавить"}
          </button>
        )}
      </div>

      {attached.length === 0 && !showPicker && (
        <p className="text-xs text-muted-foreground/60">Нет компонентов</p>
      )}

      {attached.map((comp) => (
        <div key={comp.tempId} className="flex items-center gap-2 py-1">
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${typeColors[comp.type]}`}>
            {itemTypeLabels[comp.type].slice(0, 3)}
          </Badge>
          <span className="text-xs text-foreground truncate flex-1">{comp.name}</span>
          <span className="text-[10px] text-muted-foreground shrink-0">расход:</span>
          <Input
            type="number"
            value={comp.quantity}
            onChange={(e) => onUpdateQuantity(comp.tempId, e.target.value)}
            className="h-7 text-xs w-16"
            min="0.01"
            step="0.01"
          />
          <button
            onClick={() => onDetach(comp.tempId)}
            className="text-xs text-red-500 hover:text-red-700 shrink-0"
          >
            x
          </button>
        </div>
      ))}

      {showPicker && unattached.length > 0 && (
        <div className="mt-1 rounded border border-border bg-muted/50 p-2 space-y-0.5 max-h-32 overflow-y-auto">
          {unattached.map((comp) => (
            <button
              key={comp.tempId}
              onClick={() => {
                onAttach(comp.tempId, parentTempId);
                if (unattached.length <= 1) setShowPicker(false);
              }}
              className="w-full text-left px-2 py-1 rounded text-xs hover:bg-accent transition-colors flex items-center gap-2"
            >
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${typeColors[comp.type]}`}>
                {itemTypeLabels[comp.type].slice(0, 3)}
              </Badge>
              <span className="truncate">{comp.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Подкомпоненты шагов ---

function ProductStep({
  product,
  setProduct,
  productTempId,
  isPaired,
  setIsPaired,
  getAvailableComponents,
  getComponentsOf,
  onAttach,
  onDetach,
  onUpdateQuantity,
}: {
  product: ProductData;
  setProduct: (p: ProductData) => void;
  productTempId: string;
  isPaired: boolean;
  setIsPaired: (v: boolean) => void;
  getAvailableComponents: (excludeTempId?: string) => (ConstructorItem & { type: ItemType })[];
  getComponentsOf: (parentTempId: string) => (ConstructorItem & { type: ItemType })[];
  onAttach: (componentTempId: string, parentTempId: string) => void;
  onDetach: (componentTempId: string) => void;
  onUpdateQuantity: (componentTempId: string, quantity: string) => void;
}) {
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
              onChange={(e) => setProduct({ ...product, name: e.target.value })}
              placeholder={isPaired ? "Базовое название (без лев/прав)" : "Например: Кронштейн"}
              className="h-9 text-sm"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPaired}
                onChange={(e) => setIsPaired(e.target.checked)}
                className="rounded border-border"
              />
              <span className="text-xs text-foreground">Парная деталь (левая / правая)</span>
            </label>
            {isPaired && (
              <p className="text-[11px] text-muted-foreground mt-1 ml-5">
                Будет создано 2 изделия: &laquo;{product.name || "..."} левое&raquo; и &laquo;{product.name || "..."} правое&raquo;. Парные заготовки тоже продублируются.
              </p>
            )}
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Единица измерения</label>
            <Select value={product.unit} onValueChange={(v) => setProduct({ ...product, unit: v })}>
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
            <label className="text-xs text-muted-foreground mb-1 block">Описание</label>
            <Input
              value={product.description}
              onChange={(e) => setProduct({ ...product, description: e.target.value })}
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

function ItemsStep({
  step,
  stepInfo,
  items,
  typeColors,
  onAdd,
  onUpdate,
  onSelectExisting,
  onClearExisting,
  onRemove,
  getAvailableComponents,
  getComponentsOf,
  onAttach,
  onDetach,
  onUpdateQuantity,
}: {
  step: number;
  stepInfo: { type: ItemType; label: string; componentsFrom: string };
  items: ConstructorItem[];
  typeColors: Record<ItemType, string>;
  onAdd: () => void;
  onUpdate: (tempId: string, field: keyof ConstructorItem, value: string | boolean) => void;
  onSelectExisting: (tempId: string, dbItem: DbItem) => void;
  onClearExisting: (tempId: string) => void;
  onRemove: (tempId: string) => void;
  getAvailableComponents: (excludeTempId?: string) => (ConstructorItem & { type: ItemType })[];
  getComponentsOf: (parentTempId: string) => (ConstructorItem & { type: ItemType })[];
  onAttach: (componentTempId: string, parentTempId: string) => void;
  onDetach: (componentTempId: string) => void;
  onUpdateQuantity: (componentTempId: string, quantity: string) => void;
}) {
  const hasComponents = step > 0; // у сырья нет компонентов
  const isMaterial = step === 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-foreground">{stepInfo.label}</p>
            <Badge variant="outline" className={`text-xs px-2 py-0 ${typeColors[stepInfo.type]}`}>
              {itemTypeLabels[stepInfo.type]}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isMaterial
              ? "Добавьте сырье и материалы с закупочными ценами"
              : `Добавьте позиции и выберите компоненты из ${stepInfo.componentsFrom}`}
          </p>
        </div>
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onAdd}>
          + Добавить
        </Button>
      </div>

      {items.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">Нет добавленных позиций</p>
          <p className="text-xs text-muted-foreground mt-1">
            Нажмите «Добавить» или «Пропустить»
          </p>
        </div>
      )}

      {items.map((item, idx) => (
        <ItemCard
          key={item.tempId}
          item={item}
          idx={idx}
          stepInfo={stepInfo}
          isMaterial={isMaterial}
          typeColors={typeColors}
          onUpdate={onUpdate}
          onSelectExisting={onSelectExisting}
          onClearExisting={onClearExisting}
          onRemove={onRemove}
          hasComponents={hasComponents}
          getAvailableComponents={getAvailableComponents}
          getComponentsOf={getComponentsOf}
          onAttach={onAttach}
          onDetach={onDetach}
          onUpdateQuantity={onUpdateQuantity}
        />
      ))}
    </div>
  );
}

function DbItemButton({ dbItem, onClick }: { dbItem: DbItem; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-2 py-1 rounded text-sm hover:bg-accent transition-colors flex items-center gap-2"
    >
      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${typeColors[dbItem.type as ItemType] || ""}`}>
        {itemTypeLabels[dbItem.type as ItemType] || dbItem.type}
      </Badge>
      <span className="truncate">{dbItem.name}</span>
    </button>
  );
}

function ItemCard({
  item,
  idx,
  stepInfo,
  isMaterial,
  typeColors,
  onUpdate,
  onSelectExisting,
  onClearExisting,
  onRemove,
  hasComponents,
  getAvailableComponents,
  getComponentsOf,
  onAttach,
  onDetach,
  onUpdateQuantity,
}: {
  item: ConstructorItem;
  idx: number;
  stepInfo: { type: ItemType; label: string; componentsFrom: string };
  isMaterial: boolean;
  typeColors: Record<ItemType, string>;
  onUpdate: (tempId: string, field: keyof ConstructorItem, value: string | boolean) => void;
  onSelectExisting: (tempId: string, dbItem: DbItem) => void;
  onClearExisting: (tempId: string) => void;
  onRemove: (tempId: string) => void;
  hasComponents: boolean;
  getAvailableComponents: (excludeTempId?: string) => (ConstructorItem & { type: ItemType })[];
  getComponentsOf: (parentTempId: string) => (ConstructorItem & { type: ItemType })[];
  onAttach: (componentTempId: string, parentTempId: string) => void;
  onDetach: (componentTempId: string) => void;
  onUpdateQuantity: (componentTempId: string, quantity: string) => void;
}) {
  const { query, setQuery, filtered, grouped, isSearching, loading, load } = useDbSearch();
  const [showSearch, setShowSearch] = useState(false);
  const [openCats, setOpenCats] = useState<Set<string>>(new Set());

  const toggleSearch = () => {
    const next = !showSearch;
    setShowSearch(next);
    if (next) load();
  };

  const toggleCat = (catId: string) => {
    setOpenCats((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  };

  const selectItem = (dbItem: DbItem) => {
    onSelectExisting(item.tempId, dbItem);
    setShowSearch(false);
    setQuery("");
  };

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">
            {stepInfo.label} #{idx + 1}
          </span>
          {item.existingId && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-emerald-50 text-emerald-700 border-emerald-300">
              из базы
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!item.existingId && (
            <button
              onClick={toggleSearch}
              className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
            >
              {showSearch ? "Скрыть поиск" : "Из базы"}
            </button>
          )}
          {item.existingId && (
            <button
              onClick={() => {
                onClearExisting(item.tempId);
                setShowSearch(false);
              }}
              className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
            >
              Создать новую
            </button>
          )}
          <button
            onClick={() => onRemove(item.tempId)}
            className="text-xs text-red-500 hover:text-red-700 transition-colors"
          >
            Удалить
          </button>
        </div>
      </div>

      {showSearch && !item.existingId && (
        <div className="rounded-lg border border-border bg-muted/50 p-2 space-y-1.5">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по названию..."
            className="h-8 text-sm"
          />
          {loading && <p className="text-xs text-muted-foreground">Загрузка...</p>}

          {!loading && isSearching && filtered.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-0.5">
              {filtered.map((dbItem) => (
                <DbItemButton key={dbItem.id} dbItem={dbItem} onClick={() => selectItem(dbItem)} />
              ))}
            </div>
          )}

          {!loading && !isSearching && grouped && grouped.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {grouped.map((group) => {
                const isOpen = openCats.has(group.type);
                return (
                  <div key={group.type}>
                    <button
                      onClick={() => toggleCat(group.type)}
                      className="w-full text-left px-2 py-1.5 rounded text-xs font-medium text-foreground hover:bg-accent transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${typeColors[group.type]}`}>
                          {group.label}
                        </Badge>
                      </div>
                      <span className="text-muted-foreground">{isOpen ? "▾" : "▸"} {group.items.length}</span>
                    </button>
                    {isOpen && (
                      <div className="pl-2 space-y-0.5">
                        {group.items.map((dbItem) => (
                          <DbItemButton key={dbItem.id} dbItem={dbItem} onClick={() => selectItem(dbItem)} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {!loading && isSearching && filtered.length === 0 && (
            <p className="text-xs text-muted-foreground">Ничего не найдено</p>
          )}
          {!loading && !isSearching && (!grouped || grouped.length === 0) && (
            <p className="text-xs text-muted-foreground">База пуста</p>
          )}
        </div>
      )}

      {item.existingId ? (
        <div className="rounded border border-emerald-200 bg-emerald-50 p-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${typeColors[stepInfo.type]}`}>
              {itemTypeLabels[stepInfo.type]}
            </Badge>
            <span className="text-sm font-medium">{item.name}</span>
            <span className="text-xs text-muted-foreground">ID: {item.existingId.slice(0, 8)}...</span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="sm:col-span-2">
            <label className="text-xs text-muted-foreground mb-1 block">Название</label>
            <Input
              value={item.name}
              onChange={(e) => onUpdate(item.tempId, "name", e.target.value)}
              placeholder="Название"
              className="h-8 text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Единица</label>
            <Select
              value={item.unit}
              onValueChange={(v) => onUpdate(item.tempId, "unit", v)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(unitLabels).map(([k, v]) => (
                  <SelectItem key={k} value={k} className="text-sm">{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              {isMaterial ? "Закупочная цена, руб" : "Расценка, руб"}
            </label>
            <Input
              value={item.pricePerUnit}
              onChange={(e) => onUpdate(item.tempId, "pricePerUnit", e.target.value)}
              className="h-8 text-sm"
              type="number"
              min="0"
              step="0.01"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Описание</label>
            <Input
              value={item.description}
              onChange={(e) => onUpdate(item.tempId, "description", e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          {isMaterial && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Расход на изделие</label>
              <Input
                value={item.quantity}
                onChange={(e) => onUpdate(item.tempId, "quantity", e.target.value)}
                className="h-8 text-sm"
                type="number"
                min="0"
                step="0.01"
              />
            </div>
          )}

          {isMaterial && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Кол-во на складе</label>
              <Input
                value={item.stockQuantity}
                onChange={(e) => onUpdate(item.tempId, "stockQuantity", e.target.value)}
                className="h-8 text-sm"
                type="number"
                min="0"
                step="0.01"
              />
            </div>
          )}
        </div>
      )}

      {/* Чекбокс "Парная" для заготовок */}
      {hasComponents && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={item.isPaired}
            onChange={(e) => onUpdate(item.tempId, "isPaired", e.target.checked)}
            className="rounded border-border"
          />
          <span className="text-xs text-foreground">Парная (лев/прав)</span>
        </label>
      )}

      {/* Секция компонентов (для шагов начиная с заготовок) */}
      {hasComponents && item.name.trim() && (
        <ComponentsSection
          parentTempId={item.tempId}
          componentsFrom={stepInfo.componentsFrom}
          getAvailableComponents={() => getAvailableComponents(item.tempId)}
          getComponentsOf={getComponentsOf}
          onAttach={onAttach}
          onDetach={onDetach}
          onUpdateQuantity={onUpdateQuantity}
        />
      )}
    </div>
  );
}

function SummaryStep({
  product,
  productTempId,
  blanks,
  materials,
  typeColors,
  isPaired,
}: {
  product: ProductData;
  productTempId: string;
  blanks: ConstructorItem[];
  materials: ConstructorItem[];
  typeColors: Record<ItemType, string>;
  isPaired: boolean;
}) {
  const allItems = [
    ...materials.filter((i) => i.name),
    ...blanks.filter((i) => i.name),
  ];

  const newItems = allItems.filter((i) => !i.existingId);
  const existingItems = allItems.filter((i) => i.existingId);
  const linkedItems = allItems.filter((i) => i.parentTempId);
  const pairedBlanks = blanks.filter((i) => i.name && i.isPaired);

  const counts = {
    material: materials.filter((i) => i.name).length,
    blank: blanks.filter((i) => i.name).length,
  };

  const productCount = isPaired ? 2 : 1;
  const extraPairedItems = isPaired ? pairedBlanks.length : 0;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-foreground">Итоговая сводка</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Проверьте структуру перед созданием
        </p>
      </div>

      {isPaired && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-2.5">
          <p className="text-xs text-blue-700 font-medium">Парная деталь</p>
          <p className="text-[11px] text-blue-600 mt-0.5">
            Будет создано 2 изделия (левое/правое){pairedBlanks.length > 0 && `, ${pairedBlanks.length} заготовок продублировано`}.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {(["material", "blank"] as const).map((type) => (
          <div key={type} className="rounded-lg border border-border bg-card p-2.5 text-center">
            <p className="text-lg font-semibold text-foreground">{counts[type]}</p>
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${typeColors[type]}`}>
              {itemTypeLabels[type]}
            </Badge>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="outline" className={`text-xs px-2 py-0 ${typeColors.product}`}>
            {itemTypeLabels.product}
          </Badge>
          <span className="text-sm font-medium text-foreground">
            {isPaired ? `${product.name} (лев/прав)` : product.name}
          </span>
          <span className="text-xs text-muted-foreground">
            ({unitLabels[product.unit as keyof typeof unitLabels]})
          </span>
        </div>
        {product.description && (
          <p className="text-xs text-muted-foreground">{product.description}</p>
        )}
      </div>

      {allItems.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-4 text-center">
          <p className="text-sm text-muted-foreground">
            Не добавлено ни одного компонента. Изделие будет создано без BOM-связей.
          </p>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Будет создано: {productCount} {productCount === 2 ? "изделия" : "изделие"}, {newItems.length + extraPairedItems} новых компонентов, {existingItems.length} привязано из базы, {linkedItems.length * productCount} BOM-связей.
      </p>
    </div>
  );
}
