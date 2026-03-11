"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useWarehouse } from "../WarehouseContext";
import { Button } from "@/components/ui/button";
import { itemTypeLabels } from "@/lib/constants";
import type { NomenclatureItem } from "@/lib/types";
import { useConstructorBom } from "./use-constructor-bom";
import { useConstructorColumns } from "./use-constructor-columns";
import { ItemCard } from "./ItemCard";
import { AddSlot } from "./AddSlot";
import { LinkOverlay } from "./LinkOverlay";
import { ZoomControls } from "./ZoomControls";
import { toast } from "sonner";

/* ── Карточка изделия в списке ── */

function ProductListCard({
  product,
  childrenCount,
  onClick,
}: {
  product: NomenclatureItem;
  childrenCount: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left border-[1.5px] border-emerald-300 rounded-lg px-4 py-3 bg-white hover:bg-emerald-50/50 transition-colors"
    >
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
          {itemTypeLabels.product}
        </span>
        <span className="text-sm font-medium">{product.name}</span>
        <span className="text-xs text-muted-foreground ml-auto">{product.code}</span>
      </div>
      <div className="text-[11px] text-muted-foreground mt-1.5">
        {childrenCount > 0 ? `${childrenCount} компонент.` : "BOM не настроен"}
      </div>
    </button>
  );
}

/* ── Главный компонент (orchestrator) ── */

export function ChainConstructor() {
  const { items, bomChildren, balances } = useWarehouse();
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  // Режим создания цепочки с нуля (без выбранного изделия)
  const [creatingNew, setCreatingNew] = useState(false);

  // Пустые колонки заготовок (для создания цепочки с нуля)
  const [extraBlankCols, setExtraBlankCols] = useState(0);
  // Несвязанные карточки (добавлены через AddSlot, ещё не в BOM)
  const [unlinkedCards, setUnlinkedCards] = useState<{ itemId: string; slotIdx: number }[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { localBom, columnsBom, removedIds, addLink, removeLink, updateQuantity, removeItem, isDirty, save, saving } =
    useConstructorBom(selectedProductId);

  const columns = useConstructorColumns(columnsBom, selectedProductId, removedIds);

  const products = useMemo(() => items.filter((i) => i.type === "product"), [items]);
  const selectedProduct = selectedProductId
    ? items.find((i) => i.id === selectedProductId) ?? null
    : null;

  const itemsById = useMemo(() => {
    const map = new Map<string, NomenclatureItem>();
    for (const i of items) map.set(i.id, i);
    return map;
  }, [items]);

  // Display columns: BOM columns + extra пустые (минимум 1 — Сырьё)
  const displayCols = useMemo(() => {
    const minCols = 1 + extraBlankCols;
    const len = Math.max(columns.length, minCols);
    const result: Array<Array<{ itemId: string; quantity: number; parentItemId: string }>> = [];
    for (let i = 0; i < len; i++) {
      result.push(columns[i] ? [...columns[i]] : []);
    }
    return result;
  }, [columns, extraBlankCols]);

  // Items уже использованные
  const usedIds = useMemo(() => {
    const set = new Set<string>();
    if (selectedProductId) set.add(selectedProductId);
    for (const col of columns) for (const ci of col) set.add(ci.itemId);
    for (const card of unlinkedCards) set.add(card.itemId);
    return set;
  }, [selectedProductId, columns, unlinkedCards]);

  // Фильтрация по типу колонки
  const availableMaterials = useMemo(
    () => items.filter((i) => i.type === "material" && !usedIds.has(i.id)),
    [items, usedIds],
  );
  const availableBlanks = useMemo(
    () => items.filter((i) => i.type === "blank" && !usedIds.has(i.id)),
    [items, usedIds],
  );

  // Колонка каждого item (BOM + unlinked + product)
  const itemColMap = useMemo(() => {
    const map = new Map<string, number>();
    displayCols.forEach((col, colIdx) => {
      for (const ci of col) map.set(ci.itemId, colIdx);
    });
    for (const card of unlinkedCards) {
      if (!map.has(card.itemId)) map.set(card.itemId, card.slotIdx);
    }
    if (selectedProductId) map.set(selectedProductId, displayCols.length);
    return map;
  }, [displayCols, unlinkedCards, selectedProductId]);

  // IDs элементов в BOM (достижимы от product)
  const bomItemIds = useMemo(() => {
    const set = new Set<string>();
    for (const col of columns) for (const ci of col) set.add(ci.itemId);
    return set;
  }, [columns]);

  // Unlinked items сгруппированные по колонке
  const unlinkedByCol = useMemo(() => {
    const map: Record<number, typeof unlinkedCards> = {};
    for (const card of unlinkedCards) {
      if (!map[card.slotIdx]) map[card.slotIdx] = [];
      map[card.slotIdx].push(card);
    }
    return map;
  }, [unlinkedCards]);

  // Links для LinkOverlay
  const allLinks = useMemo(() => {
    const result: { fromId: string; toId: string }[] = [];
    for (const [parentId, children] of Object.entries(localBom)) {
      for (const child of children) {
        result.push({ fromId: `card-${child.childId}`, toId: `card-${parentId}` });
      }
    }
    return result;
  }, [localBom]);

  // Доступные изделия для выбора (в режиме создания)
  const availableProducts = useMemo(
    () => items.filter((i) => i.type === "product"),
    [items],
  );

  // Сброс при смене product
  useEffect(() => {
    setExtraBlankCols(0);
    setUnlinkedCards([]);
    setSelectedCard(null);
  }, [selectedProductId]);

  // --- Linking ---

  const clearSelection = useCallback(() => setSelectedCard(null), []);

  const handleCardClick = useCallback(
    (itemId: string) => {
      if (itemId === selectedProductId && !selectedCard) return;

      if (!selectedCard) {
        if (itemId !== selectedProductId) setSelectedCard(itemId);
        return;
      }

      if (itemId === selectedCard) {
        clearSelection();
        return;
      }

      const sourceCol = itemColMap.get(selectedCard) ?? -1;
      const targetCol = itemColMap.get(itemId) ?? -1;

      if (targetCol === sourceCol + 1) {
        // Если связываем material с blank — начальный qty = weight заготовки
        const childItem = itemsById.get(selectedCard);
        const parentItem = itemsById.get(itemId);
        const initialQty = childItem?.type === "material" && parentItem?.weight
          ? parentItem.weight : 1;
        addLink(itemId, selectedCard, initialQty);
        clearSelection();
        return;
      }

      if (itemId !== selectedProductId) {
        setSelectedCard(itemId);
      } else {
        clearSelection();
      }
    },
    [selectedCard, selectedProductId, itemColMap, addLink, clearSelection],
  );

  // Esc
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedCard) clearSelection();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [selectedCard, clearSelection]);

  // Клик вне карточки
  const handleAreaClick = useCallback(
    (e: React.MouseEvent) => {
      if (!selectedCard) return;
      const t = e.target as HTMLElement;
      if (t.closest("[data-card-id]") || t.closest("input") || t.closest("button")) return;
      clearSelection();
    },
    [selectedCard, clearSelection],
  );

  // Ctrl+scroll zoom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom((z) => Math.max(0.4, Math.min(1.5, +(z + delta).toFixed(2))));
      }
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  const handleRemoveLink = useCallback(
    (fromId: string, toId: string) => {
      const childId = fromId.replace("card-", "");
      const parentId = toId.replace("card-", "");
      removeLink(parentId, childId);
    },
    [removeLink],
  );

  // Добавить несвязанную карточку в колонку
  const handleAddUnlinked = useCallback((colIdx: number, itemId: string) => {
    setUnlinkedCards((prev) => [...prev, { itemId, slotIdx: colIdx }]);
  }, []);

  // Удалить несвязанную карточку
  const handleRemoveUnlinked = useCallback((itemId: string) => {
    setUnlinkedCards((prev) => prev.filter((c) => c.itemId !== itemId));
  }, []);

  // Удалить колонку заготовки
  const handleRemoveColumn = useCallback(
    (colIdx: number) => {
      if (colIdx === 0) return; // Сырьё не удаляется

      // Удалить BOM items в этой колонке
      const bomCol = displayCols[colIdx] || [];
      for (const entry of bomCol) removeItem(entry.itemId);

      // Удалить unlinked + переиндексировать
      setUnlinkedCards((prev) =>
        prev
          .filter((c) => c.slotIdx !== colIdx)
          .map((c) => (c.slotIdx > colIdx ? { ...c, slotIdx: c.slotIdx - 1 } : c)),
      );

      // Если extra колонка (за пределами BOM) — уменьшить счётчик
      if (colIdx >= columns.length) {
        setExtraBlankCols((prev) => Math.max(0, prev - 1));
      }
    },
    [displayCols, columns.length, removeItem],
  );

  // Save — несвязанные карточки просто не попадут в BOM
  const handleSave = useCallback(async () => {
    await save();
  }, [save]);

  // Layout
  const totalCols = displayCols.length + 1;
  const minWidth = totalCols * 230 + (totalCols - 1) * 64;
  const selectedCol = selectedCard ? (itemColMap.get(selectedCard) ?? -1) : -1;
  const blankColumnsCount = displayCols.length > 1 ? displayCols.length - 1 : 0;
  const hasDirtyOrUnlinked = isDirty || unlinkedCards.length > 0;

  /* ── Список изделий ── */

  if (!selectedProduct && !creatingNew) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-border">
          <span className="text-sm font-semibold text-foreground">
            Конструктор изделий
          </span>
          {products.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCreatingNew(true)}
              className="ml-auto text-xs"
            >
              Создать цепочку
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-2">
          {products.map((product) => (
            <ProductListCard
              key={product.id}
              product={product}
              childrenCount={(bomChildren[product.id] || []).length}
              onClick={() => setSelectedProductId(product.id)}
            />
          ))}
        </div>
        {products.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Нет изделий. Создайте изделие в номенклатуре.
          </p>
        )}
      </div>
    );
  }

  /* ── Редактор BOM ── */

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-border">
        <button
          type="button"
          onClick={() => {
            if (hasDirtyOrUnlinked && !window.confirm("Есть несохранённые изменения. Выйти без сохранения?")) return;
            setSelectedProductId(null);
            setCreatingNew(false);
            clearSelection();
          }}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          &larr; Назад
        </button>
        {selectedProduct ? (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
              {itemTypeLabels.product}
            </span>
            <span className="text-sm font-semibold">{selectedProduct.name}</span>
            <span className="text-xs text-muted-foreground">{selectedProduct.code}</span>
          </div>
        ) : (
          <span className="text-sm font-semibold text-foreground">Новая цепочка</span>
        )}
        <div className="flex-1" />
        {selectedProduct && (
          <Button size="sm" disabled={!isDirty || saving} onClick={handleSave}>
            {saving ? "Сохранение..." : "Сохранить"}
          </Button>
        )}
      </div>

      {/* Hint bar */}
      <div
        className={`text-[12px] border rounded-lg px-3 py-2 flex items-center gap-2 min-h-[36px] transition-all ${
          selectedCard
            ? "bg-blue-50 border-blue-300 text-blue-800"
            : "bg-white border-gray-200 text-gray-500"
        }`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
            selectedCard ? "bg-blue-500" : "bg-gray-400"
          }`}
        />
        {selectedCard ? (
          <>
            <span>
              Выбрано: {itemsById.get(selectedCard)?.name}. Кликните на карточку справа, чтобы
              связать.
            </span>
            <button
              type="button"
              onClick={clearSelection}
              className="ml-auto text-[11px] text-gray-500 border border-gray-300 rounded px-2 py-0.5 bg-white hover:bg-gray-50"
            >
              Отмена
            </button>
          </>
        ) : (
          <>
            <span>
              Кликните на карточку, чтобы начать связь. Наведите на линию, чтобы удалить.
            </span>
            <button
              type="button"
              onClick={() => setExtraBlankCols((prev) => prev + 1)}
              className="ml-auto text-[11px] text-gray-500 border border-gray-300 rounded px-2.5 py-0.5 bg-white hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all whitespace-nowrap"
            >
              + Заготовка
            </button>
          </>
        )}
      </div>

      {/* Zoom + columns */}
      <div ref={scrollRef} className="overflow-x-auto relative">
        <div className="sticky top-0 left-0 z-20 mb-3">
          <ZoomControls zoom={zoom} onZoomChange={setZoom} />
        </div>

        <div
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "top left",
            width: `${100 / zoom}%`,
          }}
        >
          <div
            ref={containerRef}
            className="relative flex gap-x-16 min-h-[200px] px-2 pb-5"
            style={{ minWidth: `${minWidth}px` }}
            onClick={handleAreaClick}
          >
            <LinkOverlay
              links={allLinks}
              containerRef={containerRef}
              onRemoveLink={handleRemoveLink}
              zoom={zoom}
            />

            {/* Колонки */}
            {displayCols.map((col, colIdx) => {
              const isMaterialCol = colIdx === 0;
              const label = isMaterialCol
                ? "Сырьё"
                : blankColumnsCount === 1
                  ? "Заготовки"
                  : `Заготовка ${colIdx}`;

              const unlinkedInCol = unlinkedByCol[colIdx] || [];

              return (
                <div key={colIdx} className="min-w-[230px] flex-shrink-0 relative z-[1]">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <span>{label}</span>
                    {/* Крестик удаления колонки заготовки */}
                    {!isMaterialCol && (
                      <button
                        type="button"
                        onClick={() => handleRemoveColumn(colIdx)}
                        className="ml-auto text-[10px] text-gray-300 px-1 py-0.5 rounded border border-transparent hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-all"
                        title="Удалить колонку"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* BOM items */}
                  {col.map((entry) => {
                    const item = itemsById.get(entry.itemId);
                    if (!item) return null;

                    if (item.type === "material") {
                      return (
                        <ItemCard
                          key={entry.itemId}
                          item={item}
                          balance={balances[item.id] ?? null}
                          onRemove={() => removeItem(entry.itemId)}
                          isSelected={selectedCard === entry.itemId}
                          isLinkTarget={selectedCard !== null && colIdx === selectedCol + 1}
                          onClick={() => handleCardClick(entry.itemId)}
                          cardId={`card-${entry.itemId}`}
                        />
                      );
                    }

                    // Blank: найти weight из связи с material
                    const materialChild = (localBom[entry.itemId] || []).find((c) => {
                      const ci = itemsById.get(c.childId);
                      return ci?.type === "material";
                    });
                    const blankWeight = materialChild?.quantity ?? item.weight ?? null;

                    // Локальный расчёт потенциала: остаток сырья / вес заготовки
                    let localPotential: number | null = null;
                    if (materialChild && blankWeight && blankWeight > 0) {
                      const matBalance = balances[materialChild.childId] ?? 0;
                      localPotential = Math.floor(matBalance / blankWeight);
                    }

                    return (
                      <ItemCard
                        key={entry.itemId}
                        item={item}
                        quantity={entry.quantity}
                        weight={blankWeight}
                        onQuantityChange={(q) =>
                          updateQuantity(entry.parentItemId, entry.itemId, q)
                        }
                        onWeightChange={materialChild
                          ? (w) => updateQuantity(entry.itemId, materialChild.childId, w)
                          : undefined
                        }
                        onRemove={() => removeItem(entry.itemId)}
                        isSelected={selectedCard === entry.itemId}
                        isLinkTarget={selectedCard !== null && colIdx === selectedCol + 1}
                        onClick={() => handleCardClick(entry.itemId)}
                        cardId={`card-${entry.itemId}`}
                        potential={localPotential}
                      />
                    );
                  })}

                  {/* Unlinked items (скрываем если уже в BOM columns) */}
                  {unlinkedInCol.filter((c) => !bomItemIds.has(c.itemId)).map((card) => {
                    const item = itemsById.get(card.itemId);
                    if (!item) return null;

                    // Проверяем localBom: может карточка уже связана, но ещё не в columnsBom
                    if (item.type === "blank") {
                      // Найти родителя в localBom (кто ссылается на эту заготовку)
                      let parentEntry: { parentId: string; quantity: number } | null = null;
                      for (const [pid, children] of Object.entries(localBom)) {
                        const found = children.find((c) => c.childId === card.itemId);
                        if (found) { parentEntry = { parentId: pid, quantity: found.quantity }; break; }
                      }

                      // Найти дочернее сырьё в localBom
                      const materialChild = (localBom[card.itemId] || []).find((c) => {
                        const ci = itemsById.get(c.childId);
                        return ci?.type === "material";
                      });
                      const blankWeight = materialChild?.quantity ?? item.weight ?? null;

                      let localPotential: number | null = null;
                      if (materialChild && blankWeight && blankWeight > 0) {
                        const matBalance = balances[materialChild.childId] ?? 0;
                        localPotential = Math.floor(matBalance / blankWeight);
                      }

                      return (
                        <ItemCard
                          key={card.itemId}
                          item={item}
                          quantity={parentEntry?.quantity}
                          weight={blankWeight}
                          onQuantityChange={parentEntry
                            ? (q) => updateQuantity(parentEntry.parentId, card.itemId, q)
                            : undefined
                          }
                          onWeightChange={materialChild
                            ? (w) => updateQuantity(card.itemId, materialChild.childId, w)
                            : undefined
                          }
                          onRemove={() => handleRemoveUnlinked(card.itemId)}
                          isSelected={selectedCard === card.itemId}
                          isLinkTarget={selectedCard !== null && colIdx === selectedCol + 1}
                          onClick={() => handleCardClick(card.itemId)}
                          cardId={`card-${card.itemId}`}
                          potential={localPotential}
                        />
                      );
                    }

                    return (
                      <ItemCard
                        key={card.itemId}
                        item={item}
                        balance={item.type === "material" ? (balances[item.id] ?? null) : undefined}
                        onRemove={() => handleRemoveUnlinked(card.itemId)}
                        isSelected={selectedCard === card.itemId}
                        isLinkTarget={selectedCard !== null && colIdx === selectedCol + 1}
                        onClick={() => handleCardClick(card.itemId)}
                        cardId={`card-${card.itemId}`}
                      />
                    );
                  })}

                  {/* AddSlot — материалы для col 0, заготовки для остальных */}
                  <AddSlot
                    items={isMaterialCol ? availableMaterials : availableBlanks}
                    onSelect={(id) => handleAddUnlinked(colIdx, id)}
                    placeholder="+ Добавить..."
                  />
                </div>
              );
            })}

            {/* Изделие */}
            <div className="min-w-[230px] flex-shrink-0 relative z-[1]">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Изделие
              </div>
              {selectedProduct ? (
                <ItemCard
                  item={selectedProduct}
                  cardId={`card-${selectedProductId}`}
                  isLinkTarget={
                    selectedCard !== null && selectedCol === displayCols.length - 1
                  }
                  onClick={() => handleCardClick(selectedProductId!)}
                />
              ) : (
                <AddSlot
                  items={availableProducts}
                  onSelect={(id) => {
                    setSelectedProductId(id);
                    setCreatingNew(false);
                  }}
                  placeholder="Выберите изделие..."
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
