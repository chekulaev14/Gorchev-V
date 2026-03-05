"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type NomenclatureItem,
  type ItemType,
  itemTypeLabels,
  unitLabels,
} from "@/data/nomenclature";

interface Props {
  items: NomenclatureItem[];
  balances: Record<string, number>;
  onRefresh: () => void;
}

const typeColors: Record<ItemType, string> = {
  material: "bg-amber-100 text-amber-800 border-amber-300",
  blank: "bg-orange-100 text-orange-800 border-orange-300",
  part: "bg-blue-100 text-blue-800 border-blue-300",
  subassembly: "bg-purple-100 text-purple-800 border-purple-300",
  product: "bg-emerald-100 text-emerald-800 border-emerald-300",
};

const typeOrder: ItemType[] = ["material", "blank", "part", "subassembly", "product"];

export function StockTab({ items, balances, onRefresh }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showZeroOnly, setShowZeroOnly] = useState(false);
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

  const filtered = useMemo(() => {
    let result = items;

    if (showZeroOnly) {
      result = result.filter((i) => (balances[i.id] ?? 0) === 0);
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter((i) => i.name.toLowerCase().includes(q));
    }

    return result;
  }, [items, search, showZeroOnly, balances]);

  const grouped = useMemo(() => {
    const groups: Record<ItemType, NomenclatureItem[]> = {
      material: [],
      blank: [],
      part: [],
      subassembly: [],
      product: [],
    };
    for (const item of filtered) {
      groups[item.type].push(item);
    }
    for (const type of typeOrder) {
      groups[type].sort((a, b) => a.name.localeCompare(b.name, "ru"));
    }
    return groups;
  }, [filtered]);

  const effectiveExpanded = useMemo(() => {
    if (search) {
      const all = new Set<ItemType>();
      for (const type of typeOrder) {
        if (grouped[type].length > 0) all.add(type);
      }
      return all;
    }
    return expandedTypes;
  }, [search, expandedTypes, grouped]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <Input
          placeholder="Поиск по названию..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-card border-border text-foreground placeholder:text-muted-foreground text-sm h-9 w-full sm:max-w-xs"
        />

        <Button
          variant="ghost"
          size="sm"
          className={`text-sm h-8 px-3 ${showZeroOnly ? "bg-red-100 text-red-600" : "text-muted-foreground"}`}
          onClick={() => setShowZeroOnly(!showZeroOnly)}
        >
          Нулевые
        </Button>
      </div>

      <div className="space-y-1">
        {typeOrder.map((type) => {
          const group = grouped[type];
          if (group.length === 0) return null;
          const isExpanded = effectiveExpanded.has(type);

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
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-muted-foreground text-sm font-medium h-8 pl-10">Наименование</TableHead>
                      <TableHead className="text-muted-foreground text-sm font-medium h-8 w-28 text-right">Остаток</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.map((item) => {
                      const bal = balances[item.id] ?? 0;
                      return (
                        <TableRow
                          key={item.id}
                          className="border-border/50 hover:bg-accent/50 cursor-pointer"
                          onClick={() => router.push(`/warehouse/nomenclature/${item.id}`)}
                        >
                          <TableCell className="py-2 pl-10">
                            <span className="text-foreground text-sm">{item.name}</span>
                          </TableCell>
                          <TableCell className="py-2 text-right">
                            <span className={`text-sm font-mono ${bal === 0 ? "text-destructive" : "text-foreground"}`}>
                              {formatNumber(bal)} {unitLabels[item.unit]}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatNumber(n: number): string {
  if (Number.isInteger(n)) return n.toLocaleString("ru-RU");
  return n.toLocaleString("ru-RU", { maximumFractionDigits: 3 });
}
