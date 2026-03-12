"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { itemTypeLabels, typeColors } from "@/lib/constants";
import type { NomenclatureItem } from "@/lib/types";
import type { BomVersion } from "./BomConstructor";

interface EditLine {
  componentItemId: string;
  quantity: number;
}

interface Props {
  item: NomenclatureItem;
  allItems: NomenclatureItem[];
  versions: BomVersion[];
  loading: boolean;
  onCreateDraft: (lines: EditLine[]) => void;
  onUpdateDraft: (bomId: string, lines: EditLine[]) => void;
  onActivate: (bomId: string) => void;
  onDeleteDraft: (bomId: string) => void;
}

export function BomEditor({ item, allItems, versions, loading, onCreateDraft, onUpdateDraft, onActivate, onDeleteDraft }: Props) {
  const [lines, setLines] = useState<EditLine[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  const draft = versions.find((v) => v.status === "DRAFT");
  const active = versions.find((v) => v.status === "ACTIVE");

  // При смене позиции или при загрузке versions — инициализировать lines
  useEffect(() => {
    if (draft) {
      setLines(draft.lines.map((l) => ({ componentItemId: l.componentItemId, quantity: l.quantity })));
    } else if (active) {
      setLines(active.lines.map((l) => ({ componentItemId: l.componentItemId, quantity: l.quantity })));
    } else {
      setLines([]);
    }
    setIsDirty(false);
  }, [versions, item.id]);

  // Доступные для добавления: все items кроме текущего и уже добавленных
  const usedIds = new Set(lines.map((l) => l.componentItemId));
  const availableItems = allItems.filter((i) => i.id !== item.id && !usedIds.has(i.id));

  const handleAddLine = (itemId: string | null) => {
    if (!itemId) return;
    setLines([...lines, { componentItemId: itemId, quantity: 1 }]);
    setIsDirty(true);
  };

  const handleRemoveLine = (idx: number) => {
    setLines(lines.filter((_, i) => i !== idx));
    setIsDirty(true);
  };

  const handleQtyChange = (idx: number, value: string) => {
    const qty = Number(value);
    if (isNaN(qty)) return;
    setLines(lines.map((l, i) => i === idx ? { ...l, quantity: qty } : l));
    setIsDirty(true);
  };

  const handleSave = () => {
    const validLines = lines.filter((l) => l.quantity > 0);
    if (validLines.length === 0) return;

    if (draft) {
      onUpdateDraft(draft.id, validLines);
    } else {
      onCreateDraft(validLines);
    }
    setIsDirty(false);
  };

  const handleActivate = () => {
    if (draft) onActivate(draft.id);
  };

  const handleDeleteDraft = () => {
    if (draft) onDeleteDraft(draft.id);
  };

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Загрузка...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-foreground">{item.name}</h2>
          <Badge variant="outline" className={`text-xs px-2 py-0.5 ${typeColors[item.type]}`}>
            {itemTypeLabels[item.type]}
          </Badge>
          {draft && <Badge className="bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5">Черновик v{draft.version}</Badge>}
          {active && <Badge className="bg-green-100 text-green-800 text-xs px-2 py-0.5">Активная v{active.version}</Badge>}
        </div>
        <div className="flex gap-2">
          {isDirty && lines.length > 0 && (
            <Button size="sm" className="h-7 text-xs" onClick={handleSave}>
              Сохранить черновик
            </Button>
          )}
          {draft && !isDirty && draft.lines.length > 0 && (
            <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700" onClick={handleActivate}>
              Активировать
            </Button>
          )}
          {draft && (
            <Button variant="outline" size="sm" className="h-7 text-xs text-destructive" onClick={handleDeleteDraft}>
              Удалить черновик
            </Button>
          )}
        </div>
      </div>

      {/* Строки состава */}
      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <div className="grid grid-cols-[1fr_100px_40px] gap-2 px-3 py-2 bg-muted/30 text-xs text-muted-foreground font-medium border-b border-border">
          <span>Компонент</span>
          <span>Количество</span>
          <span></span>
        </div>

        {lines.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground text-center">
            Состав пуст. Добавьте компоненты.
          </div>
        ) : (
          lines.map((line, idx) => {
            const comp = allItems.find((i) => i.id === line.componentItemId);
            return (
              <div key={line.componentItemId} className="grid grid-cols-[1fr_100px_40px] gap-2 items-center px-3 py-2 border-b border-border/50">
                <div className="flex items-center gap-1.5 min-w-0">
                  {comp && (
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${typeColors[comp.type]}`}>
                      {itemTypeLabels[comp.type]}
                    </Badge>
                  )}
                  <span className="text-sm text-foreground truncate">{comp?.name ?? line.componentItemId}</span>
                  {comp && <span className="text-[10px] text-muted-foreground font-mono shrink-0">{comp.code}</span>}
                </div>
                <Input
                  type="number"
                  min={0.0001}
                  step="any"
                  value={line.quantity}
                  onChange={(e) => handleQtyChange(idx, e.target.value)}
                  className="h-7 text-xs"
                />
                <button
                  className="text-destructive hover:text-destructive/80 text-sm"
                  onClick={() => handleRemoveLine(idx)}
                  title="Удалить"
                >
                  ✕
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Добавить компонент — вне overflow-hidden контейнера, чтобы dropdown не обрезался */}
      <SearchableSelect
        items={availableItems}
        value={null}
        onChange={handleAddLine}
        getKey={(i) => i.id}
        getLabel={(i) => `${i.name} (${i.code})`}
        filterFn={(i, q) => { const lq = q.toLowerCase(); return i.name.toLowerCase().includes(lq) || i.code.toLowerCase().includes(lq); }}
        placeholder="+ Добавить компонент..."
        className="text-xs"
      />

      {/* История версий */}
      {versions.length > 1 && (
        <div>
          <h3 className="text-xs text-muted-foreground font-medium mb-2">История версий</h3>
          <div className="space-y-1">
            {versions.filter((v) => v.id !== draft?.id).map((v) => (
              <div key={v.id} className="flex items-center gap-2 text-xs px-3 py-1.5 bg-card border border-border rounded">
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${v.status === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                  {v.status === "ACTIVE" ? "Активная" : "Архив"}
                </Badge>
                <span className="text-muted-foreground">v{v.version}</span>
                <span className="text-muted-foreground">— {v.lines.length} поз.</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
