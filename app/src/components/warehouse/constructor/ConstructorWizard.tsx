"use client";

import { useReducer, useState, useCallback } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import type { ItemType } from "@/lib/types";
import {
  wizardReducer,
  createInitialState,
  nextTempId,
  canGoNext as checkCanGoNext,
  canFinish,
  getAvailableComponents,
  getComponentsOf,
  STEPS,
} from "./wizard-reducer";
import type { DbItem } from "./wizard-reducer";
import { WizardShell } from "./WizardShell";
import { ItemsStep } from "./ItemsStep";
import { ProductStep } from "./ProductStep";
import { SummaryStep } from "./SummaryStep";
import { TreePreview } from "./TreePreview";

export type { ConstructorItem } from "./wizard-reducer";

export function ConstructorWizard() {
  const router = useRouter();
  const [state, dispatch] = useReducer(wizardReducer, undefined, createInitialState);
  const [creating, setCreating] = useState(false);
  const [productTempId] = useState(() => nextTempId());

  // --- DB items (загружаем один раз, передаём вниз) ---
  const [dbItems, setDbItems] = useState<DbItem[]>([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [dbLoaded, setDbLoaded] = useState(false);

  const loadDbItems = useCallback(async () => {
    if (dbLoaded) return;
    setDbLoading(true);
    try {
      const data = await api.get<{ items: DbItem[] }>("/api/nomenclature", { silent: true });
      const sorted = (data.items || []).sort((a: DbItem, b: DbItem) =>
        a.name.localeCompare(b.name, "ru")
      );
      setDbItems(sorted);
      setDbLoaded(true);
    } catch {
      // silent
    } finally {
      setDbLoading(false);
    }
  }, [dbLoaded]);

  // --- Селекторы (замыкания на state) ---
  const getAvailable = useCallback(
    (stepIndex: number, excludeTempId?: string) => getAvailableComponents(state, stepIndex, excludeTempId),
    [state]
  );

  const getComponents = useCallback(
    (parentTempId: string) => getComponentsOf(state, parentTempId),
    [state]
  );

  // --- Создание изделия ---
  const handleCreate = async () => {
    if (!canFinish(state)) {
      toast.error("Заполните название изделия");
      return;
    }

    setCreating(true);
    const { materials, blanks, product, isPaired } = state;

    const allComponents = [
      ...materials.filter((i) => i.name.trim()),
      ...blanks.filter((i) => i.name.trim()),
    ];

    const typeMap = new Map<string, ItemType>();
    materials.forEach((i) => typeMap.set(i.tempId, "material"));
    blanks.forEach((i) => typeMap.set(i.tempId, "blank"));

    const payload = {
      product: { name: product.name, unit: product.unit, description: product.description, weight: product.weight ? Number(product.weight) : undefined },
      isPaired,
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

  const { step, materials, blanks, product, isPaired } = state;

  return (
    <WizardShell
      step={step}
      onStepChange={(s) => dispatch({ type: "SET_STEP", step: s })}
      canGoNext={checkCanGoNext(state)}
      creating={creating}
      onCancel={() => router.push("/warehouse")}
      onCreate={handleCreate}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          {step >= 0 && step <= 1 && (
            <ItemsStep
              step={step}
              stepInfo={STEPS[step]}
              items={step === 0 ? materials : blanks}
              onAdd={() => dispatch({ type: "ADD_ITEM", stepIndex: step })}
              onUpdate={(tempId, field, value) =>
                dispatch({ type: "UPDATE_ITEM", stepIndex: step, tempId, field, value })
              }
              onSelectExisting={(tempId, dbItem) =>
                dispatch({ type: "SELECT_EXISTING", stepIndex: step, tempId, dbItem })
              }
              onClearExisting={(tempId) =>
                dispatch({ type: "CLEAR_EXISTING", stepIndex: step, tempId })
              }
              onRemove={(tempId) => dispatch({ type: "REMOVE_ITEM", stepIndex: step, tempId })}
              dbItems={dbItems}
              dbLoading={dbLoading}
              loadDbItems={loadDbItems}
              getAvailableComponents={(excludeTempId) => getAvailable(step, excludeTempId)}
              getComponentsOf={getComponents}
              onAttach={(cId, pId) => dispatch({ type: "ATTACH_COMPONENT", componentTempId: cId, parentTempId: pId })}
              onDetach={(cId) => dispatch({ type: "DETACH_COMPONENT", componentTempId: cId })}
              onUpdateQuantity={(cId, q) => dispatch({ type: "UPDATE_QUANTITY", componentTempId: cId, quantity: q })}
            />
          )}

          {step === 2 && (
            <ProductStep
              product={product}
              onProductChange={(p) => dispatch({ type: "SET_PRODUCT", product: p })}
              productTempId={productTempId}
              isPaired={isPaired}
              onPairedChange={(v) => dispatch({ type: "TOGGLE_PAIRED", isPaired: v })}
              getAvailableComponents={() => getAvailable(2, undefined)}
              getComponentsOf={getComponents}
              onAttach={(cId, pId) => dispatch({ type: "ATTACH_COMPONENT", componentTempId: cId, parentTempId: pId })}
              onDetach={(cId) => dispatch({ type: "DETACH_COMPONENT", componentTempId: cId })}
              onUpdateQuantity={(cId, q) => dispatch({ type: "UPDATE_QUANTITY", componentTempId: cId, quantity: q })}
            />
          )}

          {step === 3 && (
            <SummaryStep
              product={product}
              productTempId={productTempId}
              blanks={blanks}
              materials={materials}
              isPaired={isPaired}
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
                isPaired={isPaired}
              />
            </div>
          </div>
        </div>
      </div>
    </WizardShell>
  );
}
