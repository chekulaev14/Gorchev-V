"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { NomenclatureItem } from "@/lib/types";
import { itemTypeLabels, unitLabels, typeColors, formatNumber } from "@/lib/constants";
import { api } from "@/lib/api-client";

export interface BomChild {
  item: NomenclatureItem;
  quantity: number;
}

interface BomTreeProps {
  entries: BomChild[];
  balances: Record<string, number>;
  editMode: boolean;
  editingQty: Record<string, string>;
  onStartEditQty: (childId: string, currentQty: number) => void;
  onCancelEditQty: (childId: string) => void;
  onChangeEditQty: (childId: string, value: string) => void;
  onSaveQty: (childId: string) => void;
  onRemoveChild: (childId: string, childName: string) => void;
}

function BomTreeNode({ child, balances, depth }: { child: BomChild; balances: Record<string, number>; depth: number }) {
  const [expanded, setExpanded] = useState(false);
  const [grandChildren, setGrandChildren] = useState<BomChild[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const mayHaveChildren = child.item.type !== "material";
  const hasChildren = loaded ? grandChildren.length > 0 : mayHaveChildren;
  const childBalance = balances[child.item.id] ?? 0;

  useEffect(() => {
    if (child.item.type === "material") { setLoaded(true); return; }
    setLoading(true);
    api.get<{ children: BomChild[] }>(`/api/nomenclature?itemId=${child.item.id}`, { silent: true })
      .then((data) => setGrandChildren(data.children || []))
      .catch(() => setGrandChildren([]))
      .finally(() => { setLoaded(true); setLoading(false); });
  }, [child.item.id, child.item.type]);

  const toggle = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const childCanAssemble = loaded && grandChildren.length > 0
    ? Math.min(...grandChildren.map((cc) => {
        const av = balances[cc.item.id] ?? 0;
        return cc.quantity > 0 ? Math.floor(av / cc.quantity) : 0;
      }))
    : null;

  return (
    <div>
      <div
        className={`bg-card rounded border border-border px-3 py-2 ${
          hasChildren ? "cursor-pointer hover:bg-accent/30" : ""
        }`}
        style={{ marginLeft: depth * 40 }}
        onClick={() => hasChildren && toggle()}
      >
        <div className="flex items-center gap-2 min-w-0 mb-1">
          {hasChildren && (
            <span className="text-muted-foreground text-sm w-4 shrink-0 select-none">
              {loading ? "…" : expanded ? "−" : "+"}
            </span>
          )}
          {!hasChildren && <span className="w-4 shrink-0" />}
          <Badge variant="outline" className={`text-xs px-2 py-0.5 shrink-0 ${typeColors[child.item.type]}`}>
            {itemTypeLabels[child.item.type]}
          </Badge>
          <span className="text-foreground text-sm truncate">{child.item.name}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-mono" style={{ marginLeft: 24 }}>
          {childCanAssemble !== null && (
            <span className={`text-xs ${childCanAssemble > 0 ? "text-emerald-600" : "text-destructive"}`}>
              собрать: {childCanAssemble}
            </span>
          )}
          <span className="text-muted-foreground">
            расход: {formatNumber(child.quantity)} {unitLabels[child.item.unit]}
          </span>
          <span className={`${childBalance > 0 ? "text-muted-foreground" : "text-destructive"}`}>
            склад: {formatNumber(childBalance)}
          </span>
        </div>
      </div>

      {expanded && grandChildren.length > 0 && (
        <div className="space-y-1 mt-1">
          {grandChildren.map((gc) => (
            <BomTreeNode key={gc.item.id} child={gc} balances={balances} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function EditRow({ child, editingQty, onStartEditQty, onCancelEditQty, onChangeEditQty, onSaveQty, onRemoveChild }: {
  child: BomChild;
  editingQty: Record<string, string>;
  onStartEditQty: (childId: string, currentQty: number) => void;
  onCancelEditQty: (childId: string) => void;
  onChangeEditQty: (childId: string, value: string) => void;
  onSaveQty: (childId: string) => void;
  onRemoveChild: (childId: string, childName: string) => void;
}) {
  const isEditing = editingQty[child.item.id] !== undefined;

  return (
    <div className="bg-card rounded border border-border px-3 py-2">
      <div className="flex items-center gap-2 min-w-0 mb-1">
        <Badge variant="outline" className={`text-xs px-2 py-0.5 shrink-0 ${typeColors[child.item.type]}`}>
          {itemTypeLabels[child.item.type]}
        </Badge>
        <span className="text-foreground text-sm truncate">{child.item.name}</span>
      </div>
      <div className="flex items-center gap-2 ml-0">
        {isEditing ? (
          <>
            <Input
              type="number"
              step="0.001"
              min="0.001"
              value={editingQty[child.item.id]}
              onChange={(e) => onChangeEditQty(child.item.id, e.target.value)}
              className="h-7 text-xs w-20"
            />
            <Button size="sm" className="h-7 text-xs px-2" onClick={() => onSaveQty(child.item.id)}>
              OK
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => onCancelEditQty(child.item.id)}>
              ✕
            </Button>
          </>
        ) : (
          <>
            <span className="text-muted-foreground text-sm font-mono">
              расход: {formatNumber(child.quantity)} {unitLabels[child.item.unit]}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs px-1.5 text-muted-foreground"
              onClick={() => onStartEditQty(child.item.id, child.quantity)}
            >
              изм.
            </Button>
            <ConfirmDialog
              title="Убрать компонент?"
              description={`Убрать «${child.item.name}» из состава?`}
              confirmLabel="Убрать"
              variant="destructive"
              onConfirm={() => onRemoveChild(child.item.id, child.item.name)}
            >
              {(open) => (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs px-1.5 text-destructive"
                  onClick={open}
                >
                  убрать
                </Button>
              )}
            </ConfirmDialog>
          </>
        )}
      </div>
    </div>
  );
}

export function BomTree({
  entries: bomChildren,
  balances,
  editMode,
  editingQty,
  onStartEditQty,
  onCancelEditQty,
  onChangeEditQty,
  onSaveQty,
  onRemoveChild,
}: BomTreeProps) {
  return (
    <div className="space-y-1">
      {bomChildren.map((child) => (
        <div key={child.item.id}>
          {editMode ? (
            <EditRow
              child={child}
              editingQty={editingQty}
              onStartEditQty={onStartEditQty}
              onCancelEditQty={onCancelEditQty}
              onChangeEditQty={onChangeEditQty}
              onSaveQty={onSaveQty}
              onRemoveChild={onRemoveChild}
            />
          ) : (
            <BomTreeNode child={child} balances={balances} depth={0} />
          )}
        </div>
      ))}
    </div>
  );
}
