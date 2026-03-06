"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { GroupedAccordion } from "@/components/ui/grouped-accordion";
import type { NomenclatureItem, ItemType } from "@/lib/types";
import { itemTypeLabels, typeColors, formatNumber } from "@/lib/constants";
import { useWarehouse } from "@/components/warehouse/WarehouseContext";

interface Props {
  items: NomenclatureItem[];
  balances: Record<string, number>;
}

const assemblyTypeOrder: ItemType[] = ["product"];

export function AssemblyTab({ items, balances }: Props) {
  const router = useRouter();
  const { bomChildren } = useWarehouse();

  const assemblyItems = useMemo(
    () => items.filter((i) => i.type === "product" && (bomChildren[i.id]?.length ?? 0) > 0),
    [items, bomChildren]
  );

  const assemblyCapacity = useMemo(() => {
    const result: Record<string, number> = {};
    for (const item of assemblyItems) {
      const children = bomChildren[item.id] || [];
      let minCan = Infinity;
      for (const child of children) {
        const available = balances[child.item.id] ?? 0;
        const canMake = child.quantity > 0 ? Math.floor(available / child.quantity) : 0;
        minCan = Math.min(minCan, canMake);
      }
      result[item.id] = minCan === Infinity ? 0 : minCan;
    }
    return result;
  }, [assemblyItems, balances, bomChildren]);

  const shortages = useMemo(() => {
    const result: Record<string, { name: string; needed: number; available: number }[]> = {};
    for (const item of assemblyItems) {
      const children = bomChildren[item.id] || [];
      const shorts: { name: string; needed: number; available: number }[] = [];
      for (const child of children) {
        const available = balances[child.item.id] ?? 0;
        if (available < child.quantity) {
          shorts.push({ name: child.item.name, needed: child.quantity, available });
        }
      }
      if (shorts.length > 0) {
        result[item.id] = shorts;
      }
    }
    return result;
  }, [assemblyItems, balances, bomChildren]);

  const sortedItems = useMemo(() => {
    return [...assemblyItems].sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }, [assemblyItems]);

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
          {group.map((item) => {
            const canMake = assemblyCapacity[item.id] ?? 0;
            const deficit = shortages[item.id];
            const stock = balances[item.id] ?? 0;

            return (
              <div
                key={item.id}
                className="rounded border border-border/50 p-3 cursor-pointer hover:bg-accent/30 transition-colors"
                onClick={() => router.push(`/warehouse/nomenclature/${item.id}`)}
              >
                <div className="mb-1">
                  <span className="text-foreground text-sm font-medium block">{item.name}</span>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                    <span className="text-muted-foreground text-sm">
                      На складе: <span className="text-foreground font-mono">{stock}</span>
                    </span>
                    <span className={`text-sm font-mono ${canMake > 0 ? "text-emerald-600" : "text-destructive"}`}>
                      Можно собрать: {canMake}
                    </span>
                  </div>
                </div>

                {deficit && (
                  <div className="mt-2 space-y-0.5">
                    <p className="text-destructive text-xs font-medium">Не хватает для 1 шт:</p>
                    {deficit.map((d) => (
                      <p key={d.name} className="text-muted-foreground text-xs pl-2">
                        {d.name}: нужно {formatNumber(d.needed)}, есть {formatNumber(d.available)}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    />
  );
}
