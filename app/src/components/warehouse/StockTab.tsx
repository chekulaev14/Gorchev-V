"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { GroupedAccordion } from "@/components/ui/grouped-accordion";
import type { NomenclatureItem, ItemType } from "@/lib/types";
import { itemTypeLabels, unitLabels, typeColors, formatNumber } from "@/lib/constants";

interface Props {
  items: NomenclatureItem[];
  balances: Record<string, number>;
  onRefresh: () => void;
}

const typeOrder: ItemType[] = ["material", "blank", "product"];

export function StockTab({ items, balances, onRefresh }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showZeroOnly, setShowZeroOnly] = useState(false);

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

  const sortedFiltered = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (a.type !== b.type) return typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type);
      return a.name.localeCompare(b.name, "ru");
    });
  }, [filtered]);

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

      <GroupedAccordion
        items={sortedFiltered}
        groupBy={(item) => item.type}
        groupOrder={typeOrder}
        searchQuery={search || undefined}
        renderGroupHeader={(type, group) => (
          <>
            <Badge variant="outline" className={`text-sm px-2.5 py-0.5 ${typeColors[type]}`}>
              {itemTypeLabels[type]}
            </Badge>
            <span className="text-muted-foreground text-sm">{group.length} поз.</span>
          </>
        )}
        renderGroupContent={(type, group) => (
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
      />
    </div>
  );
}
