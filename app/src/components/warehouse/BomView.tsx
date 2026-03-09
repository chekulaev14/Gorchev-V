"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useWarehouse } from "@/components/warehouse/WarehouseContext";
import { ItemForm, itemFormValuesFromItem, type ItemFormValues } from "@/components/warehouse/ItemForm";
import { BomTree, type BomChild } from "@/components/warehouse/bom/BomTree";
import { BomEntryForm } from "@/components/warehouse/bom/BomEntryForm";
import type { NomenclatureItem, PotentialItem } from "@/lib/types";
import { itemTypeLabels, unitLabels, typeColors, formatNumber } from "@/lib/constants";
import { api } from "@/lib/api-client";
import { updateItemSchema } from "@/lib/schemas/nomenclature.schema";
import { toast } from "sonner";

interface Props {
  item: NomenclatureItem;
  balances: Record<string, number>;
}

export function BomView({ item, balances }: Props) {
  const router = useRouter();
  const { editMode, items: allItems, refresh, refreshAll } = useWarehouse();
  const [children, setChildren] = useState<BomChild[]>([]);
  const [parents, setParents] = useState<BomChild[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  // BOM editing
  const [addingChild, setAddingChild] = useState(false);
  const [bomSaving, setBomSaving] = useState(false);
  const [editingQty, setEditingQty] = useState<Record<string, string>>({});

  // Item editing
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ItemFormValues>(itemFormValuesFromItem(item));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(itemFormValuesFromItem(item));
    setEditing(false);
  }, [item]);

  useEffect(() => {
    setLoading(true);
    api.get<{ children: BomChild[]; parents: BomChild[] }>(`/api/nomenclature?itemId=${item.id}`, { silent: true })
      .then((data) => {
        setChildren(data.children || []);
        setParents(data.parents || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [item.id]);

  // --- Item handlers ---
  const handleSave = async () => {
    const parsed = updateItemSchema.safeParse({
      ...form,
      pricePerUnit: form.pricePerUnit ? Number(form.pricePerUnit) : null,
      categoryId: form.categoryId || null,
      description: form.description || null,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "Ошибка валидации");
      return;
    }

    setSaving(true);
    try {
      await api.put(`/api/nomenclature/${item.id}`, parsed.data);
      setEditing(false);
      refreshAll();
    } catch {
      // toast shown by api-client
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setForm(itemFormValuesFromItem(item));
    setEditing(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.del(`/api/nomenclature/${item.id}`);
      refreshAll();
      router.push("/warehouse/nomenclature");
    } catch {
      // toast shown by api-client
    } finally {
      setDeleting(false);
    }
  };

  // --- BOM handlers ---
  const reloadBom = useCallback(() => {
    api.get<{ children: BomChild[]; parents: BomChild[] }>(`/api/nomenclature?itemId=${item.id}`, { silent: true })
      .then((data) => {
        setChildren(data.children || []);
        setParents(data.parents || []);
      })
      .catch(() => {});
  }, [item.id]);

  const handleAddChild = async (childId: string, quantity: number) => {
    setBomSaving(true);
    try {
      await api.post("/api/bom", { parentId: item.id, childId, quantity });
      setAddingChild(false);
      reloadBom();
    } catch {
      // toast shown by api-client
    } finally {
      setBomSaving(false);
    }
  };

  const handleRemoveChild = async (childId: string) => {
    try {
      await api.del("/api/bom", { parentId: item.id, childId });
      reloadBom();
    } catch {
      // toast shown by api-client
    }
  };

  const handleUpdateQty = async (childId: string) => {
    const qty = Number(editingQty[childId]);
    if (!qty || qty <= 0) return;
    try {
      await api.put("/api/bom", { parentId: item.id, childId, quantity: qty });
      setEditingQty((prev) => {
        const next = { ...prev };
        delete next[childId];
        return next;
      });
      reloadBom();
    } catch {
      // toast shown by api-client
    }
  };

  // --- Potential from server ---
  const [potential, setPotential] = useState<PotentialItem | null>(null);
  useEffect(() => {
    api.get<{ items: PotentialItem[] }>(`/api/stock/potential?itemId=${item.id}`, { silent: true })
      .then((d) => setPotential(d.items[0] ?? null))
      .catch(() => {});
  }, [item.id, balances]);

  // --- Derived state ---
  const balance = balances[item.id] ?? 0;

  const deleteDescription = (() => {
    const bomCount = children.length + parents.length;
    const bomWarning = bomCount > 0
      ? `\n\nУ этой позиции связи — ${bomCount} шт. в спецификации (BOM). При удалении эти связи тоже будут убраны.`
      : "";
    return `Удалить «${item.name}»?${bomWarning}\n\nПозицию можно будет восстановить из раздела «Удалённые».`;
  })();

  return (
    <div className="space-y-4 max-w-2xl w-full">
      {/* Карточка позиции */}
      <div className="bg-card rounded-lg border border-border p-4">
        {editMode && !editing && (
          <div className="mb-3 flex gap-2">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditing(true)}>
              Редактировать
            </Button>
            <ConfirmDialog
              title="Удалить позицию?"
              description={deleteDescription}
              confirmLabel="Удалить"
              variant="destructive"
              onConfirm={handleDelete}
            >
              {(open) => (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs text-destructive border-destructive/50 hover:bg-destructive/10"
                  onClick={open}
                  disabled={deleting}
                >
                  {deleting ? "Удаление..." : "Удалить"}
                </Button>
              )}
            </ConfirmDialog>
          </div>
        )}

        {editing ? (
          <ItemForm
            mode="edit"
            values={form}
            onChange={setForm}
            onSubmit={handleSave}
            onCancel={handleCancelEdit}
            saving={saving}
          />
        ) : (
          <div className="flex items-start gap-3">
            {item.images && item.images.length > 0 && (
              <img
                src={item.images[0]}
                alt={item.name}
                className="w-20 h-20 object-cover rounded-lg border border-border"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-foreground text-base font-semibold">{item.name}</h2>
                <Badge variant="outline" className={`text-sm px-2.5 py-0.5 ${typeColors[item.type]}`}>
                  {itemTypeLabels[item.type]}
                </Badge>
              </div>
              <p className="text-muted-foreground text-xs font-mono">{item.code}</p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                <div>
                  <span className="text-muted-foreground text-xs">На складе:</span>
                  <span className="text-foreground text-base font-semibold ml-1">
                    {formatNumber(balance)} {unitLabels[item.unit]}
                  </span>
                </div>
                {potential && potential.canProduce >= 0 && children.length > 0 && (
                  <div>
                    <span className="text-muted-foreground text-xs">Потенциал:</span>
                    <span className={`text-base font-semibold ml-1 ${potential.potential > 0 ? "text-emerald-600" : "text-destructive"}`}>
                      {formatNumber(potential.potential)} шт
                    </span>
                  </div>
                )}
                {potential?.breakdown && potential.breakdown.length > 0 && (
                  <div className="w-full pt-1">
                    <span className="text-muted-foreground text-xs">Из чего:</span>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                      {potential.breakdown.map((b) => (
                        <span key={b.itemId} className="text-xs text-muted-foreground">
                          <span className="text-foreground font-medium">{b.quantity}</span> из {b.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {item.type === "product" && item.weight && (
                  <div>
                    <span className="text-muted-foreground text-xs">Вес:</span>
                    <span className="text-foreground text-base ml-1">{item.weight} кг</span>
                  </div>
                )}
                {item.pricePerUnit && (
                  <div>
                    <span className="text-muted-foreground text-xs">Расценка:</span>
                    <span className="text-emerald-600 text-base ml-1">{item.pricePerUnit} ₽</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Загрузка спецификации...</p>
      ) : (
        <>
          {/* Состав */}
          {(children.length > 0 || editMode) && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-muted-foreground text-sm font-medium">
                  Состав (из чего делается){children.length > 0 ? ` — ${children.length} поз.` : ""}
                </h3>
                {editMode && !addingChild && (
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setAddingChild(true)}>
                    + Добавить компонент
                  </Button>
                )}
              </div>

              {addingChild && (
                <BomEntryForm
                  allItems={allItems}
                  currentItemId={item.id}
                  existingChildIds={children.map((c) => c.item.id)}
                  onAdd={handleAddChild}
                  onCancel={() => setAddingChild(false)}
                  saving={bomSaving}
                />
              )}

              <BomTree
                entries={children}
                balances={balances}
                editMode={editMode}
                editingQty={editingQty}
                onStartEditQty={(childId, qty) => setEditingQty({ ...editingQty, [childId]: qty.toString() })}
                onCancelEditQty={(childId) => setEditingQty((prev) => { const n = { ...prev }; delete n[childId]; return n; })}
                onChangeEditQty={(childId, value) => setEditingQty({ ...editingQty, [childId]: value })}
                onSaveQty={handleUpdateQty}
                onRemoveChild={handleRemoveChild}
              />
            </div>
          )}

          {/* Куда входит */}
          {parents.length > 0 && (
            <div>
              <h3 className="text-muted-foreground text-sm font-medium mb-2">
                Входит в состав — {parents.length} поз.
              </h3>
              <div className="space-y-1">
                {parents.map((parent) => (
                  <div
                    key={parent.item.id}
                    className="bg-card rounded border border-border px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0 mb-1">
                      <Badge variant="outline" className={`text-xs px-2 py-0.5 shrink-0 ${typeColors[parent.item.type]}`}>
                        {itemTypeLabels[parent.item.type]}
                      </Badge>
                      <span className="text-foreground text-sm truncate">{parent.item.name}</span>
                    </div>
                    <span className="text-muted-foreground text-sm font-mono">
                      нужно x{formatNumber(parent.quantity)} {unitLabels[item.unit]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {children.length === 0 && parents.length === 0 && (
            <p className="text-muted-foreground text-sm">Нет связей в спецификации</p>
          )}
        </>
      )}
    </div>
  );
}
