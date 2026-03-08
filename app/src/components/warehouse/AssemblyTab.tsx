"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { GroupedAccordion } from "@/components/ui/grouped-accordion";
import type { PotentialItem, ItemType } from "@/lib/types";
import { itemTypeLabels, typeColors, formatNumber } from "@/lib/constants";
import { api } from "@/lib/api-client";
import { useWarehouse } from "@/components/warehouse/WarehouseContext";

const assemblyTypeOrder: ItemType[] = ["product", "blank"];

export function AssemblyTab() {
  const router = useRouter();
  const { balances } = useWarehouse();
  const [items, setItems] = useState<PotentialItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPotential = useCallback(() => {
    setLoading(true);
    api.get<{ items: PotentialItem[] }>("/api/stock/potential")
      .then((data) => setItems(data.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchPotential(); }, [fetchPotential]);

  // Перезагрузка при изменении балансов (после операций)
  const balancesKey = useMemo(() => JSON.stringify(balances), [balances]);
  useEffect(() => {
    if (!loading) fetchPotential();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balancesKey]);

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }, [items]);

  if (loading && items.length === 0) {
    return <p className="text-muted-foreground text-sm p-4">Загрузка...</p>;
  }

  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm p-4">Нет позиций с составом (BOM)</p>;
  }

  return (
    <GroupedAccordion
      items={sortedItems}
      groupBy={(item) => item.type}
      groupOrder={assemblyTypeOrder}
      renderGroupHeader={(type, group) => (
        <>
          <Badge variant="outline" className={`text-sm px-2.5 py-0.5 ${typeColors[type]}`}>
            {itemTypeLabels[type]}
          </Badge>
          <span className="text-muted-foreground text-sm">{group.length} поз.</span>
        </>
      )}
      renderGroupContent={(_type, group) => (
        <div className="space-y-1 p-2 pt-0">
          {group.map((item) => (
            <div
              key={item.itemId}
              className="rounded border border-border/50 p-3 cursor-pointer hover:bg-accent/30 transition-colors"
              onClick={() => router.push(`/warehouse/nomenclature/${item.itemId}`)}
            >
              <div className="mb-1">
                <span className="text-foreground text-sm font-medium block">{item.name}</span>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                  <span className="text-muted-foreground text-sm">
                    На складе: <span className="text-foreground font-mono">{formatNumber(item.balance)}</span>
                  </span>
                  <span className={`text-sm font-mono ${item.potential > 0 ? "text-emerald-600" : "text-destructive"}`}>
                    Потенциал: {formatNumber(item.potential)}
                  </span>
                </div>
              </div>

              {item.bottleneck && (
                <p className="text-muted-foreground text-xs mt-1">
                  Узкое место: {item.bottleneck.name} ({formatNumber(item.bottleneck.balance)} в наличии, {formatNumber(item.bottleneck.neededPerUnit)} на 1 шт)
                </p>
              )}

            </div>
          ))}
        </div>
      )}
    />
  );
}
