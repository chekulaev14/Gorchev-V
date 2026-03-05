"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  type NomenclatureItem,
  type ItemType,
  itemTypeLabels,
  getChildren,
} from "@/data/nomenclature";

interface Props {
  items: NomenclatureItem[];
  balances: Record<string, number>;
}

const typeColors: Record<ItemType, string> = {
  material: "bg-amber-100 text-amber-800 border-amber-300",
  blank: "bg-orange-100 text-orange-800 border-orange-300",
  part: "bg-blue-100 text-blue-800 border-blue-300",
  subassembly: "bg-purple-100 text-purple-800 border-purple-300",
  product: "bg-emerald-100 text-emerald-800 border-emerald-300",
};

// Только типы, которые могут собираться
const assemblyTypeOrder: ItemType[] = ["subassembly", "product"];

export function AssemblyTab({ items, balances }: Props) {
  const router = useRouter();
  const [expandedTypes, setExpandedTypes] = useState<Set<ItemType>>(new Set());

  const toggleType = (type: ItemType) => {
    setExpandedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const assemblyItems = useMemo(
    () => items.filter((i) => (i.type === "product" || i.type === "subassembly") && getChildren(i.id).length > 0),
    [items]
  );

  const assemblyCapacity = useMemo(() => {
    const result: Record<string, number> = {};
    for (const item of assemblyItems) {
      const children = getChildren(item.id);
      let minCan = Infinity;
      for (const child of children) {
        const available = balances[child.item.id] ?? 0;
        const canMake = child.quantity > 0 ? Math.floor(available / child.quantity) : 0;
        minCan = Math.min(minCan, canMake);
      }
      result[item.id] = minCan === Infinity ? 0 : minCan;
    }
    return result;
  }, [assemblyItems, balances]);

  const shortages = useMemo(() => {
    const result: Record<string, { name: string; needed: number; available: number }[]> = {};
    for (const item of assemblyItems) {
      const children = getChildren(item.id);
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
  }, [assemblyItems, balances]);

  const grouped = useMemo(() => {
    const groups: Record<ItemType, NomenclatureItem[]> = {
      material: [],
      blank: [],
      part: [],
      subassembly: [],
      product: [],
    };
    for (const item of assemblyItems) {
      groups[item.type].push(item);
    }
    for (const type of assemblyTypeOrder) {
      groups[type].sort((a, b) => a.name.localeCompare(b.name, "ru"));
    }
    return groups;
  }, [assemblyItems]);

  return (
    <div className="space-y-1">
      {assemblyTypeOrder.map((type) => {
        const group = grouped[type];
        if (group.length === 0) return null;
        const isExpanded = expandedTypes.has(type);

        return (
          <div key={type} className="rounded-lg border border-border overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-3 py-2.5 bg-card hover:bg-accent/30 transition-colors"
              onClick={() => toggleType(type)}
            >
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm w-4">
                  {isExpanded ? "−" : "+"}
                </span>
                <Badge variant="outline" className={`text-sm px-2.5 py-0.5 ${typeColors[type]}`}>
                  {itemTypeLabels[type]}
                </Badge>
                <span className="text-muted-foreground text-sm">{group.length} поз.</span>
              </div>
            </button>

            {isExpanded && (
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
          </div>
        );
      })}
    </div>
  );
}

function formatNumber(n: number): string {
  if (Number.isInteger(n)) return n.toLocaleString("ru-RU");
  return n.toLocaleString("ru-RU", { maximumFractionDigits: 3 });
}
