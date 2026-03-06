"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useWarehouse } from "@/components/warehouse/WarehouseContext";
import {
  type NomenclatureItem,
  type ItemType,
  type Unit,
  itemTypeLabels,
  unitLabels,
  categories,
} from "@/data/nomenclature";

interface BomChild {
  item: NomenclatureItem;
  quantity: number;
}

interface Props {
  item: NomenclatureItem;
  balances: Record<string, number>;
}

const typeColors: Record<ItemType, string> = {
  material: "bg-amber-100 text-amber-800 border-amber-300",
  blank: "bg-orange-100 text-orange-800 border-orange-300",
  part: "bg-blue-100 text-blue-800 border-blue-300",
  subassembly: "bg-purple-100 text-purple-800 border-purple-300",
  product: "bg-emerald-100 text-emerald-800 border-emerald-300",
};

// Рекурсивный узел дерева состава
function BomTreeNode({ child, balances, depth }: { child: BomChild; balances: Record<string, number>; depth: number }) {
  const [expanded, setExpanded] = useState(false);
  const [grandChildren, setGrandChildren] = useState<BomChild[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  // Тип не material/blank — может иметь детей (точно узнаем после загрузки)
  const mayHaveChildren = child.item.type !== "material";
  const hasChildren = loaded ? grandChildren.length > 0 : mayHaveChildren;
  const childBalance = balances[child.item.id] ?? 0;

  const toggle = useCallback(async () => {
    if (!loaded && !loading) {
      setLoading(true);
      try {
        const res = await fetch(`/api/nomenclature?itemId=${child.item.id}`);
        const data = await res.json();
        setGrandChildren(data.children || []);
      } catch {
        setGrandChildren([]);
      } finally {
        setLoaded(true);
        setLoading(false);
      }
    }
    setExpanded((prev) => !prev);
  }, [child.item.id, loaded, loading]);

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
            x{formatNumber(child.quantity)} {unitLabels[child.item.unit]}
          </span>
          <span className={`${childBalance > 0 ? "text-muted-foreground" : "text-destructive"}`}>
            ост: {formatNumber(childBalance)}
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

export function BomView({ item, balances }: Props) {
  const router = useRouter();
  const { editMode, items: allItems, refresh } = useWarehouse();
  const [children, setChildren] = useState<BomChild[]>([]);
  const [parents, setParents] = useState<BomChild[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  // BOM editing
  const [addingChild, setAddingChild] = useState(false);
  const [childSearch, setChildSearch] = useState("");
  const [childQty, setChildQty] = useState("1");
  const [bomSaving, setBomSaving] = useState(false);
  const [editingQty, setEditingQty] = useState<Record<string, string>>({});

  // Форма редактирования
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: item.name,
    description: item.description || "",
    typeId: item.type,
    unitId: item.unit,
    categoryId: item.category || "",
    pricePerUnit: item.pricePerUnit?.toString() || "",
  });
  const [saving, setSaving] = useState(false);

  // Сбросить форму при смене позиции
  useEffect(() => {
    setForm({
      name: item.name,
      description: item.description || "",
      typeId: item.type,
      unitId: item.unit,
      categoryId: item.category || "",
      pricePerUnit: item.pricePerUnit?.toString() || "",
    });
    setEditing(false);
  }, [item]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/nomenclature?itemId=${item.id}`)
      .then((r) => r.json())
      .then((data) => {
        setChildren(data.children || []);
        setParents(data.parents || []);
      })
      .finally(() => setLoading(false));
  }, [item.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/nomenclature/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setEditing(false);
        refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setForm({
      name: item.name,
      description: item.description || "",
      typeId: item.type,
      unitId: item.unit,
      categoryId: item.category || "",
      pricePerUnit: item.pricePerUnit?.toString() || "",
    });
    setEditing(false);
  };

  const reloadBom = useCallback(() => {
    fetch(`/api/nomenclature?itemId=${item.id}`)
      .then((r) => r.json())
      .then((data) => {
        setChildren(data.children || []);
        setParents(data.parents || []);
      });
  }, [item.id]);

  const handleAddChild = async (childId: string) => {
    const qty = Number(childQty);
    if (!qty || qty <= 0) return;
    setBomSaving(true);
    try {
      const res = await fetch("/api/bom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentId: item.id, childId, quantity: qty }),
      });
      if (res.ok) {
        setAddingChild(false);
        setChildSearch("");
        setChildQty("1");
        reloadBom();
      }
    } finally {
      setBomSaving(false);
    }
  };

  const handleRemoveChild = async (childId: string) => {
    if (!confirm("Убрать этот компонент из состава?")) return;
    await fetch("/api/bom", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentId: item.id, childId }),
    });
    reloadBom();
  };

  const handleUpdateQty = async (childId: string) => {
    const qty = Number(editingQty[childId]);
    if (!qty || qty <= 0) return;
    await fetch("/api/bom", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentId: item.id, childId, quantity: qty }),
    });
    setEditingQty((prev) => {
      const next = { ...prev };
      delete next[childId];
      return next;
    });
    reloadBom();
  };

  const handleDelete = async () => {
    const bomCount = children.length + parents.length;
    const bomWarning = bomCount > 0
      ? `\n\nУ этой позиции связи — ${bomCount} шт. в спецификации (BOM). При удалении эти связи тоже будут убраны.`
      : "";
    const msg = `Удалить "${item.name}"?${bomWarning}\n\nПозицию можно будет восстановить из раздела «Удалённые».`;
    if (!confirm(msg)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/nomenclature/${item.id}`, { method: "DELETE" });
      if (res.ok) {
        refresh();
        router.push("/warehouse/nomenclature");
      }
    } finally {
      setDeleting(false);
    }
  };

  const balance = balances[item.id] ?? 0;

  const canAssemble = !loading && children.length > 0
    ? Math.min(...children.map((c) => {
        const available = balances[c.item.id] ?? 0;
        return c.quantity > 0 ? Math.floor(available / c.quantity) : 0;
      }))
    : null;

  const typeOptions: ItemType[] = ["material", "blank", "part", "subassembly", "product"];
  const unitOptions = Object.keys(unitLabels) as Array<keyof typeof unitLabels>;

  return (
    <div className="space-y-4 max-w-2xl w-full">
      {/* Карточка позиции */}
      <div className="bg-card rounded-lg border border-border p-4">
        {editMode && !editing && (
          <div className="mb-3 flex gap-2">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditing(true)}>
              Редактировать
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs text-destructive border-destructive/50 hover:bg-destructive/10"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Удаление..." : "Удалить"}
            </Button>
          </div>
        )}

        {editing ? (
          <div className="space-y-3">
            <div>
              <label className="text-muted-foreground text-xs block mb-1">Название</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="h-9 text-sm"
              />
            </div>
            <div>
              <label className="text-muted-foreground text-xs block mb-1">Описание</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full bg-card border border-border text-foreground text-sm rounded px-3 py-2 min-h-[60px] resize-y"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <div>
                <label className="text-muted-foreground text-xs block mb-1">Тип</label>
                <select
                  value={form.typeId}
                  onChange={(e) => setForm({ ...form, typeId: e.target.value as ItemType })}
                  className="bg-card border border-border text-foreground text-sm rounded px-2 h-9"
                >
                  {typeOptions.map((t) => (
                    <option key={t} value={t}>{itemTypeLabels[t]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-muted-foreground text-xs block mb-1">Единица</label>
                <select
                  value={form.unitId}
                  onChange={(e) => setForm({ ...form, unitId: e.target.value as Unit })}
                  className="bg-card border border-border text-foreground text-sm rounded px-2 h-9"
                >
                  {unitOptions.map((u) => (
                    <option key={u} value={u}>{unitLabels[u]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-muted-foreground text-xs block mb-1">Категория</label>
                <select
                  value={form.categoryId}
                  onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                  className="bg-card border border-border text-foreground text-sm rounded px-2 h-9"
                >
                  <option value="">Без категории</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-muted-foreground text-xs block mb-1">Расценка, ₽</label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.pricePerUnit}
                  onChange={(e) => setForm({ ...form, pricePerUnit: e.target.value })}
                  className="h-9 text-sm w-28"
                  placeholder="—"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" className="h-8 text-xs" onClick={handleSave} disabled={saving || !form.name.trim()}>
                {saving ? "Сохранение..." : "Сохранить"}
              </Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={handleCancel} disabled={saving}>
                Отмена
              </Button>
            </div>
          </div>
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
              <p className="text-muted-foreground text-xs font-mono mb-1">{item.id}</p>
              {item.description && (
                <p className="text-muted-foreground text-sm">{item.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                <div>
                  <span className="text-muted-foreground text-xs">На складе:</span>
                  <span className="text-foreground text-base font-semibold ml-1">
                    {formatNumber(balance)} {unitLabels[item.unit]}
                  </span>
                </div>
                {canAssemble !== null && (
                  <div>
                    <span className="text-muted-foreground text-xs">Можно собрать:</span>
                    <span className={`text-base font-semibold ml-1 ${canAssemble > 0 ? "text-emerald-600" : "text-destructive"}`}>
                      {canAssemble} шт
                    </span>
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
          {/* Состав — рекурсивное дерево */}
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

              {/* Форма добавления компонента */}
              {addingChild && (
                <div className="bg-card rounded-lg border border-border p-3 mb-2 space-y-2">
                  <Input
                    placeholder="Поиск позиции..."
                    value={childSearch}
                    onChange={(e) => setChildSearch(e.target.value)}
                    className="h-8 text-sm"
                    autoFocus
                  />
                  {childSearch.length >= 2 && (
                    <div className="max-h-40 overflow-y-auto border border-border rounded">
                      {allItems
                        .filter((i) =>
                          i.id !== item.id &&
                          !children.some((c) => c.item.id === i.id) &&
                          (i.name.toLowerCase().includes(childSearch.toLowerCase()) ||
                           i.id.toLowerCase().includes(childSearch.toLowerCase()))
                        )
                        .slice(0, 10)
                        .map((i) => (
                          <button
                            key={i.id}
                            className="w-full text-left px-3 py-1.5 hover:bg-accent/50 flex items-center gap-2 text-sm"
                            onClick={() => handleAddChild(i.id)}
                            disabled={bomSaving}
                          >
                            <Badge variant="outline" className={`text-xs px-1.5 py-0 shrink-0 ${typeColors[i.type]}`}>
                              {itemTypeLabels[i.type]}
                            </Badge>
                            <span className="truncate">{i.name}</span>
                          </button>
                        ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <label className="text-muted-foreground text-xs">Кол-во:</label>
                    <Input
                      type="number"
                      step="0.001"
                      min="0.001"
                      value={childQty}
                      onChange={(e) => setChildQty(e.target.value)}
                      className="h-8 text-sm w-24"
                    />
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setAddingChild(false); setChildSearch(""); }}>
                      Отмена
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                {children.map((child) => (
                  <div key={child.item.id}>
                    {editMode ? (
                      <div className="bg-card rounded border border-border px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0 mb-1">
                          <Badge variant="outline" className={`text-xs px-2 py-0.5 shrink-0 ${typeColors[child.item.type]}`}>
                            {itemTypeLabels[child.item.type]}
                          </Badge>
                          <span className="text-foreground text-sm truncate">{child.item.name}</span>
                        </div>
                        <div className="flex items-center gap-2 ml-0">
                          {editingQty[child.item.id] !== undefined ? (
                            <>
                              <Input
                                type="number"
                                step="0.001"
                                min="0.001"
                                value={editingQty[child.item.id]}
                                onChange={(e) => setEditingQty({ ...editingQty, [child.item.id]: e.target.value })}
                                className="h-7 text-xs w-20"
                              />
                              <Button size="sm" className="h-7 text-xs px-2" onClick={() => handleUpdateQty(child.item.id)}>
                                OK
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => {
                                setEditingQty((prev) => { const n = { ...prev }; delete n[child.item.id]; return n; });
                              }}>
                                ✕
                              </Button>
                            </>
                          ) : (
                            <>
                              <span className="text-muted-foreground text-sm font-mono">
                                x{formatNumber(child.quantity)} {unitLabels[child.item.unit]}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs px-1.5 text-muted-foreground"
                                onClick={() => setEditingQty({ ...editingQty, [child.item.id]: child.quantity.toString() })}
                              >
                                изм.
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs px-1.5 text-destructive"
                                onClick={() => handleRemoveChild(child.item.id)}
                              >
                                убрать
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ) : (
                      <BomTreeNode child={child} balances={balances} depth={0} />
                    )}
                  </div>
                ))}
              </div>
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

function formatNumber(n: number): string {
  if (Number.isInteger(n)) return n.toLocaleString("ru-RU");
  return n.toLocaleString("ru-RU", { maximumFractionDigits: 3 });
}
