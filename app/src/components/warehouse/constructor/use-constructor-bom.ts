"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useWarehouse } from "../WarehouseContext";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import type { LocalBomMap } from "./types";

export function useConstructorBom(productId: string | null) {
  const { bomChildren, items, refresh, refreshAll } = useWarehouse();
  const [localBom, setLocalBom] = useState<LocalBomMap>({});
  // columnsBom — стабильная копия для расчёта колонок.
  // Обновляется при загрузке и addLink, НЕ при removeLink.
  const [columnsBom, setColumnsBom] = useState<LocalBomMap>({});
  const [saving, setSaving] = useState(false);
  // ID удалённых карточек — columnsBom не трогаем, только скрываем
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  // Ключ, зафиксированный после save — чтобы isDirty не мигал пока refreshAll не вернёт данные
  const [savedKey, setSavedKey] = useState<string | null>(null);

  // Загрузка из bomChildren → localBom + columnsBom
  useEffect(() => {
    if (!productId) {
      setLocalBom({});
      setColumnsBom({});
      setRemovedIds(new Set());
      return;
    }

    const bom: LocalBomMap = {};
    const visited = new Set<string>();

    function collect(parentId: string) {
      if (visited.has(parentId)) return;
      visited.add(parentId);

      const children = bomChildren[parentId];
      if (!children || children.length === 0) return;

      bom[parentId] = children.map((c) => ({
        childId: c.item.id,
        quantity: c.quantity,
      }));

      for (const child of children) {
        collect(child.item.id);
      }
    }

    collect(productId);
    setLocalBom(bom);
    setColumnsBom(bom);
    setRemovedIds(new Set());
    setSavedKey(null);
  }, [productId, bomChildren]);

  // --- Helpers ---

  function cleanOrphans(bom: LocalBomMap, rootId: string): LocalBomMap {
    const reachable = new Set<string>();
    function walk(id: string) {
      if (reachable.has(id)) return;
      reachable.add(id);
      for (const c of bom[id] || []) walk(c.childId);
    }
    walk(rootId);

    const clean: LocalBomMap = {};
    for (const [pid, children] of Object.entries(bom)) {
      if (reachable.has(pid)) clean[pid] = children;
    }
    return clean;
  }

  // --- CRUD ---

  const addLink = useCallback((parentId: string, childId: string, initialQty?: number) => {
    const updater = (prev: LocalBomMap) => {
      const existing = prev[parentId] || [];
      if (existing.some((c) => c.childId === childId)) return prev;
      return { ...prev, [parentId]: [...existing, { childId, quantity: initialQty ?? 1 }] };
    };
    setLocalBom(updater);
    // columnsBom НЕ обновляем — позиции карточек стабильны до save+refresh
  }, []);

  const removeLink = useCallback((parentId: string, childId: string) => {
    // Обновляем только localBom (линии/save), НЕ columnsBom (позиции карточек)
    setLocalBom((prev) => {
      const existing = prev[parentId];
      if (!existing) return prev;
      const filtered = existing.filter((c) => c.childId !== childId);
      const next = { ...prev };
      if (filtered.length === 0) delete next[parentId];
      else next[parentId] = filtered;
      return next;
    });
  }, []);

  const updateQuantity = useCallback((parentId: string, childId: string, qty: number) => {
    const updater = (prev: LocalBomMap) => {
      const existing = prev[parentId];
      if (!existing) return prev;
      return {
        ...prev,
        [parentId]: existing.map((c) =>
          c.childId === childId ? { ...c, quantity: qty } : c,
        ),
      };
    };
    setLocalBom(updater);
    setColumnsBom(updater);
  }, []);

  const removeItem = useCallback((itemId: string) => {
    if (!productId) return;
    const pid = productId;

    // localBom: удаляем блок + cleanOrphans (для корректного save)
    setLocalBom((prev) => {
      const next = { ...prev };
      delete next[itemId];
      for (const [parentKey, children] of Object.entries(next)) {
        const filtered = children.filter((c) => c.childId !== itemId);
        if (filtered.length === 0) delete next[parentKey];
        else next[parentKey] = filtered;
      }
      return cleanOrphans(next, pid);
    });
    // columnsBom НЕ трогаем — depth остаётся стабильным, карточку скрываем через removedIds
    setRemovedIds((prev) => new Set(prev).add(itemId));
  }, [productId]);

  // --- isDirty ---

  const serverKey = useMemo(() => {
    if (!productId) return "";
    const pairs: string[] = [];
    const visited = new Set<string>();
    function collect(parentId: string) {
      if (visited.has(parentId)) return;
      visited.add(parentId);
      for (const c of bomChildren[parentId] || []) {
        pairs.push(`${parentId}:${c.item.id}:${c.quantity}`);
        collect(c.item.id);
      }
    }
    collect(productId);
    return pairs.sort().join("|");
  }, [productId, bomChildren]);

  const localKey = useMemo(() => {
    const pairs: string[] = [];
    for (const [pid, children] of Object.entries(localBom)) {
      for (const c of children) {
        pairs.push(`${pid}:${c.childId}:${c.quantity}`);
      }
    }
    return pairs.sort().join("|");
  }, [localBom]);

  const isDirty = serverKey !== localKey && savedKey !== localKey;

  // --- Save (diff) ---

  const save = useCallback(async () => {
    if (!productId) return;
    setSaving(true);
    try {
      const serverLinks = new Map<string, number>();
      const visited = new Set<string>();
      function collectServer(parentId: string) {
        if (visited.has(parentId)) return;
        visited.add(parentId);
        for (const c of bomChildren[parentId] || []) {
          serverLinks.set(`${parentId}:${c.item.id}`, c.quantity);
          collectServer(c.item.id);
        }
      }
      collectServer(productId);

      const localLinks = new Map<string, number>();
      for (const [pid, children] of Object.entries(localBom)) {
        for (const c of children) {
          localLinks.set(`${pid}:${c.childId}`, c.quantity);
        }
      }

      for (const key of serverLinks.keys()) {
        if (!localLinks.has(key)) {
          const [parentId, childId] = key.split(":");
          await api.del("/api/bom", { parentId, childId });
        }
      }

      for (const [key, qty] of localLinks.entries()) {
        if (!serverLinks.has(key)) {
          const [parentId, childId] = key.split(":");
          await api.post("/api/bom", { parentId, childId, quantity: qty });
        }
      }

      for (const [key, qty] of localLinks.entries()) {
        const serverQty = serverLinks.get(key);
        if (serverQty !== undefined && serverQty !== qty) {
          const [parentId, childId] = key.split(":");
          await api.put("/api/bom", { parentId, childId, quantity: qty });
        }
      }

      // Обновить weight номенклатуры для заготовок, если изменился
      const itemsMap = new Map(items.map((i) => [i.id, i]));
      for (const [pid, children] of Object.entries(localBom)) {
        for (const child of children) {
          const parentItem = itemsMap.get(pid);
          const childItem = itemsMap.get(child.childId);
          if (parentItem?.type === "blank" && childItem?.type === "material") {
            if (parentItem.weight == null || child.quantity !== parentItem.weight) {
              await api.put(`/api/nomenclature/${pid}`, { weight: child.quantity });
            }
          }
        }
      }

      toast.success("BOM сохранён");
      setSavedKey(localKey);
      refreshAll();
    } catch {
      // api-client покажет toast
    } finally {
      setSaving(false);
    }
  }, [productId, localBom, localKey, bomChildren, items, refreshAll]);

  return {
    localBom, columnsBom, removedIds, addLink, removeLink, updateQuantity, removeItem,
    isDirty, save, saving,
  };
}
