"use client";

import { useMemo } from "react";
import type { LocalBomMap, ColumnItem } from "./types";

function computeDepthFromLeaf(
  itemId: string,
  bomMap: LocalBomMap,
  cache: Map<string, number>,
): number {
  if (cache.has(itemId)) return cache.get(itemId)!;
  const children = bomMap[itemId] || [];
  if (children.length === 0) {
    cache.set(itemId, 0);
    return 0;
  }
  const maxChild = Math.max(
    ...children.map((c) => computeDepthFromLeaf(c.childId, bomMap, cache)),
  );
  const depth = maxChild + 1;
  cache.set(itemId, depth);
  return depth;
}

export function useConstructorColumns(
  columnsBom: LocalBomMap,
  productId: string | null,
  removedIds?: Set<string>,
): ColumnItem[][] {
  return useMemo(() => {
    if (!productId) return [];

    const depthCache = new Map<string, number>();
    computeDepthFromLeaf(productId, columnsBom, depthCache);

    const byDepth = new Map<number, ColumnItem[]>();
    const seen = new Set<string>();

    function collect(parentId: string) {
      const children = columnsBom[parentId] || [];
      for (const child of children) {
        if (seen.has(child.childId)) continue;
        seen.add(child.childId);

        const d = depthCache.get(child.childId) ?? 0;
        if (!byDepth.has(d)) byDepth.set(d, []);
        byDepth.get(d)!.push({
          itemId: child.childId,
          quantity: child.quantity,
          parentItemId: parentId,
        });
        collect(child.childId);
      }
    }

    collect(productId);

    const maxDepth = byDepth.size > 0 ? Math.max(...byDepth.keys()) : -1;
    const columns: ColumnItem[][] = [];
    for (let d = 0; d <= maxDepth; d++) {
      const col = (byDepth.get(d) || []).filter(
        (ci) => !removedIds?.has(ci.itemId),
      );
      columns.push(col);
    }
    // Убрать trailing пустые колонки
    while (columns.length > 0 && columns[columns.length - 1].length === 0) {
      columns.pop();
    }
    return columns;
  }, [columnsBom, productId, removedIds]);
}
