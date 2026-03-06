"use client";

import { useState } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api-client";
import { createMovementSchema } from "@/lib/schemas/stock.schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { NomenclatureItem, ItemType } from "@/lib/types";
import { itemTypeLabels, unitLabels, typeColors, formatNumber } from "@/lib/constants";
import { useWarehouse } from "@/components/warehouse/WarehouseContext";

interface Props {
  items: NomenclatureItem[];
  balances: Record<string, number>;
  onRefresh: () => void;
}

type OperationType = "supplier" | "production" | "assembly";

const opLabels: Record<OperationType, string> = {
  supplier: "Приход от поставщика",
  production: "Приход с производства",
  assembly: "Сборка / Комплектация",
};

export function OperationsTab({ items, balances, onRefresh }: Props) {
  const { bomChildren, workers } = useWarehouse();
  const [opType, setOpType] = useState<OperationType>("supplier");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("");
  const [workerId, setWorkerId] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const selectedItem = selectedItemId ? items.find((i) => i.id === selectedItemId) ?? null : null;

  const availableItems = items.filter((i) => {
    if (opType === "supplier") return i.type === "material";
    if (opType === "production") return i.type === "blank";
    if (opType === "assembly") return i.type === "product" && (bomChildren[i.id]?.length ?? 0) > 0;
    return false;
  });

  const handleSubmit = async () => {
    if (!selectedItemId || !quantity || Number(quantity) <= 0) return;

    let action: "SUPPLIER_INCOME" | "PRODUCTION_INCOME" | "ASSEMBLY";
    if (opType === "supplier") action = "SUPPLIER_INCOME";
    else if (opType === "production") action = "PRODUCTION_INCOME";
    else action = "ASSEMBLY";

    const payload = {
      action,
      itemId: selectedItemId,
      quantity: Number(quantity),
      comment: comment || undefined,
    };
    const parsed = createMovementSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "Ошибка валидации");
      return;
    }

    setSubmitting(true);

    try {
      await api.post("/api/stock", payload, { silent: true });

      const itemName = selectedItem?.name || selectedItemId;
      let msg = "";
      if (opType === "supplier") {
        msg = `Оприходовано: ${itemName} — ${quantity} ${unitLabels[selectedItem?.unit || "pcs"]}`;
      } else if (opType === "production") {
        const worker = workers.find((w) => w.id === workerId);
        msg = `Принято с производства: ${itemName} — ${quantity} шт` + (worker ? ` от ${worker.name}` : "");
      } else {
        msg = `Собрано: ${itemName} — ${quantity} шт. Компоненты списаны.`;
      }
      toast.success(msg);
      setSelectedItemId(null);
      setQuantity("");
      setWorkerId("");
      setComment("");
      onRefresh();
    } catch (err) {
      if (err instanceof ApiError && err.data.shortages) {
        const details = err.data.shortages.map((s) =>
          `${s.name}: нужно ${s.needed}, есть ${s.available}`
        ).join("; ");
        toast.error(err.data.error || "Ошибка", { description: details });
      } else if (err instanceof ApiError) {
        toast.error(err.data.error || "Ошибка");
      } else {
        toast.error("Ошибка соединения");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const assemblyPreview = opType === "assembly" && selectedItem
    ? (bomChildren[selectedItem.id] || [])
    : [];

  return (
    <div className="space-y-4 max-w-lg w-full">
      <div className="flex flex-wrap gap-1">
        {(["supplier", "production", "assembly"] as const).map((t) => (
          <Button
            key={t}
            variant="ghost"
            size="sm"
            className={`text-sm h-9 px-3 ${opType === t ? "bg-accent text-foreground" : "text-muted-foreground"}`}
            onClick={() => {
              setOpType(t);
              setSelectedItemId(null);
            }}
          >
            {opLabels[t]}
          </Button>
        ))}
      </div>

      <div className="bg-card rounded-lg border border-border p-4 space-y-3">
        <h3 className="text-foreground text-base font-medium">{opLabels[opType]}</h3>

        <div>
          <label className="text-muted-foreground text-sm block mb-1">Позиция</label>
          <SearchableSelect
            items={availableItems}
            value={selectedItemId}
            onChange={setSelectedItemId}
            getKey={(i) => i.id}
            getLabel={(i) => i.name}
            placeholder="Начните вводить название..."
            renderItem={(item) => (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`text-xs px-2 py-0.5 shrink-0 ${typeColors[item.type]}`}>
                  {itemTypeLabels[item.type]}
                </Badge>
                <span className="text-foreground text-sm truncate">{item.name}</span>
                <span className="text-muted-foreground text-xs ml-auto shrink-0">
                  {formatNumber(balances[item.id] ?? 0)} {unitLabels[item.unit]}
                </span>
              </div>
            )}
            renderSelected={(item) => (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`text-xs px-2 py-0.5 ${typeColors[item.type]}`}>
                  {itemTypeLabels[item.type]}
                </Badge>
                <span className="text-foreground text-sm">{item.name}</span>
              </div>
            )}
          />
        </div>

        <div>
          <label className="text-muted-foreground text-sm block mb-1">
            Количество{selectedItem ? ` (${unitLabels[selectedItem.unit]})` : ""}
          </label>
          <Input
            type="number"
            min="1"
            step={selectedItem?.unit === "kg" ? "0.1" : "1"}
            placeholder="0"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="bg-background border-border text-foreground text-sm h-9 max-w-32"
          />
        </div>

        {opType === "production" && (
          <div>
            <label className="text-muted-foreground text-sm block mb-1">Рабочий</label>
            <Select value={workerId} onValueChange={setWorkerId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Выберите рабочего" />
              </SelectTrigger>
              <SelectContent>
                {workers.map((w) => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div>
          <label className="text-muted-foreground text-sm block mb-1">Комментарий</label>
          <Textarea
            placeholder="Необязательно"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="bg-background border-border text-foreground text-sm min-h-[60px] resize-none"
          />
        </div>

        {opType === "assembly" && assemblyPreview.length > 0 && quantity && Number(quantity) > 0 && (
          <div className="bg-background rounded border border-border p-3">
            <p className="text-muted-foreground text-xs font-medium mb-1.5">Будет списано:</p>
            {assemblyPreview.map((child) => {
              const needed = child.quantity * Number(quantity);
              const available = balances[child.item.id] ?? 0;
              const enough = available >= needed;
              return (
                <div key={child.item.id} className="flex items-center justify-between py-0.5">
                  <span className="text-muted-foreground text-sm">{child.item.name}</span>
                  <span className={`text-sm font-mono ${enough ? "text-muted-foreground" : "text-destructive"}`}>
                    {formatNumber(needed)} {unitLabels[child.item.unit]}
                    {!enough && ` (есть ${formatNumber(available)})`}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <Button
          className="w-full h-10 text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-30"
          disabled={!selectedItemId || !quantity || Number(quantity) <= 0 || submitting}
          onClick={handleSubmit}
        >
          {submitting ? "Обработка..." : opType === "assembly" ? "Собрать" : "Оприходовать"}
        </Button>
      </div>
    </div>
  );
}
