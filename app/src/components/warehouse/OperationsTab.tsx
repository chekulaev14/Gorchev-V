"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  type NomenclatureItem,
  type ItemType,
  itemTypeLabels,
  unitLabels,
  getChildren,
} from "@/data/nomenclature";
import { workers } from "@/data/catalog";

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
  const [opType, setOpType] = useState<OperationType>("supplier");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [workerId, setWorkerId] = useState("");
  const [comment, setComment] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; shortages?: { name: string; needed: number; available: number }[] } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedItem = items.find((i) => i.id === selectedItemId);

  // Фильтр позиций для выбора в зависимости от типа операции
  const availableItems = items.filter((i) => {
    if (opType === "supplier") {
      // Приход от поставщика: только сырьё и метизы
      return i.type === "material";
    }
    if (opType === "production") {
      // Приход с производства: заготовки, детали, подсборки
      return i.type === "blank" || i.type === "part" || i.type === "subassembly";
    }
    if (opType === "assembly") {
      // Сборка: подсборки и изделия (то, что собирается из компонентов)
      return (i.type === "subassembly" || i.type === "product") && getChildren(i.id).length > 0;
    }
    return false;
  });

  const filteredItems = itemSearch
    ? availableItems.filter((i) => i.name.toLowerCase().includes(itemSearch.toLowerCase()))
    : availableItems;

  const handleSubmit = async () => {
    if (!selectedItemId || !quantity || Number(quantity) <= 0) return;

    setSubmitting(true);
    setResult(null);

    try {
      let action = "";
      if (opType === "supplier") action = "supplier_income";
      else if (opType === "production") action = "production_income";
      else action = "assembly";

      const res = await fetch("/api/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          itemId: selectedItemId,
          quantity: Number(quantity),
          performedBy: "Кладовщик",
          workerId: workerId || undefined,
          comment: comment || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setResult({
          success: false,
          message: data.error || "Ошибка",
          shortages: data.shortages,
        });
      } else {
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
        setResult({ success: true, message: msg });
        setSelectedItemId("");
        setQuantity("");
        setWorkerId("");
        setComment("");
        setItemSearch("");
        onRefresh();
      }
    } catch {
      setResult({ success: false, message: "Ошибка соединения" });
    } finally {
      setSubmitting(false);
    }
  };

  // Предпросмотр компонентов при сборке
  const assemblyPreview = opType === "assembly" && selectedItem
    ? getChildren(selectedItem.id)
    : [];

  return (
    <div className="space-y-4 max-w-lg w-full">
      {/* Выбор типа операции */}
      <div className="flex flex-wrap gap-1">
        {(["supplier", "production", "assembly"] as const).map((t) => (
          <Button
            key={t}
            variant="ghost"
            size="sm"
            className={`text-sm h-9 px-3 ${opType === t ? "bg-accent text-foreground" : "text-muted-foreground"}`}
            onClick={() => {
              setOpType(t);
              setSelectedItemId("");
              setItemSearch("");
              setResult(null);
            }}
          >
            {opLabels[t]}
          </Button>
        ))}
      </div>

      {/* Форма */}
      <div className="bg-card rounded-lg border border-border p-4 space-y-3">
        <h3 className="text-foreground text-base font-medium">{opLabels[opType]}</h3>

        {/* Выбор позиции */}
        <div className="relative">
          <label className="text-muted-foreground text-sm block mb-1">Позиция</label>
          {selectedItem ? (
            <div className="flex items-center gap-2 bg-background rounded px-3 py-2 border border-border">
              <Badge variant="outline" className={`text-xs px-2 py-0.5 ${typeColors[selectedItem.type]}`}>
                {itemTypeLabels[selectedItem.type]}
              </Badge>
              <span className="text-foreground text-sm flex-1">{selectedItem.name}</span>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground text-sm h-5 px-1"
                onClick={() => {
                  setSelectedItemId("");
                  setItemSearch("");
                }}
              >
                ✕
              </Button>
            </div>
          ) : (
            <div>
              <Input
                placeholder="Начните вводить название..."
                value={itemSearch}
                onChange={(e) => {
                  setItemSearch(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                className="bg-background border-border text-foreground text-sm h-9"
              />
              {showDropdown && filteredItems.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg max-h-48 overflow-y-auto shadow-lg">
                  {filteredItems.slice(0, 20).map((item) => (
                    <div
                      key={item.id}
                      className="px-3 py-2 hover:bg-accent cursor-pointer flex items-center gap-2"
                      onClick={() => {
                        setSelectedItemId(item.id);
                        setItemSearch("");
                        setShowDropdown(false);
                      }}
                    >
                      <Badge variant="outline" className={`text-xs px-2 py-0.5 shrink-0 ${typeColors[item.type]}`}>
                        {itemTypeLabels[item.type]}
                      </Badge>
                      <span className="text-foreground text-sm truncate">{item.name}</span>
                      <span className="text-muted-foreground text-xs ml-auto shrink-0">
                        {formatNumber(balances[item.id] ?? 0)} {unitLabels[item.unit]}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Количество */}
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

        {/* Рабочий (только для прихода с производства) */}
        {opType === "production" && (
          <div>
            <label className="text-muted-foreground text-sm block mb-1">Рабочий</label>
            <select
              value={workerId}
              onChange={(e) => setWorkerId(e.target.value)}
              className="bg-background border border-border text-foreground text-sm rounded px-3 py-2 w-full"
            >
              <option value="">Выберите рабочего</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Комментарий */}
        <div>
          <label className="text-muted-foreground text-sm block mb-1">Комментарий</label>
          <Textarea
            placeholder="Необязательно"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="bg-background border-border text-foreground text-sm min-h-[60px] resize-none"
          />
        </div>

        {/* Предпросмотр сборки */}
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

        {/* Результат */}
        {result && (
          <div className={`rounded p-3 text-sm ${
            result.success
              ? "bg-emerald-100 border border-emerald-300 text-emerald-700"
              : "bg-red-100 border border-red-300 text-red-700"
          }`}>
            <p>{result.message}</p>
            {result.shortages && (
              <div className="mt-1.5 space-y-0.5">
                {result.shortages.map((s) => (
                  <p key={s.name} className="text-xs">
                    {s.name}: нужно {s.needed}, есть {s.available}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Кнопка */}
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

const typeColors: Record<ItemType, string> = {
  material: "bg-amber-100 text-amber-800 border-amber-300",
  blank: "bg-orange-100 text-orange-800 border-orange-300",
  part: "bg-blue-100 text-blue-800 border-blue-300",
  subassembly: "bg-purple-100 text-purple-800 border-purple-300",
  product: "bg-emerald-100 text-emerald-800 border-emerald-300",
};

function formatNumber(n: number): string {
  if (Number.isInteger(n)) return n.toLocaleString("ru-RU");
  return n.toLocaleString("ru-RU", { maximumFractionDigits: 3 });
}
