"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { itemTypeLabels, typeColors } from "@/lib/constants";
import type { NomenclatureItem } from "@/lib/types";

interface Props {
  items: NomenclatureItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function BomItemList({ items, selectedId, onSelect }: Props) {
  const [search, setSearch] = useState("");

  const filtered = items.filter((item) => {
    const q = search.toLowerCase();
    return item.name.toLowerCase().includes(q) || item.code.toLowerCase().includes(q);
  });

  // Группировка: products сверху, потом blanks
  const products = filtered.filter((i) => i.type === "product");
  const blanks = filtered.filter((i) => i.type === "blank");

  return (
    <div className="w-64 shrink-0 flex flex-col border border-border rounded-lg bg-card overflow-hidden">
      <div className="p-2 border-b border-border">
        <Input
          placeholder="Поиск..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-xs"
        />
      </div>
      <div className="flex-1 overflow-auto">
        {products.length > 0 && (
          <div>
            <div className="px-3 py-1.5 text-xs text-muted-foreground font-medium bg-muted/30">
              Изделия
            </div>
            {products.map((item) => (
              <ItemRow key={item.id} item={item} selected={item.id === selectedId} onSelect={onSelect} />
            ))}
          </div>
        )}
        {blanks.length > 0 && (
          <div>
            <div className="px-3 py-1.5 text-xs text-muted-foreground font-medium bg-muted/30">
              Заготовки
            </div>
            {blanks.map((item) => (
              <ItemRow key={item.id} item={item} selected={item.id === selectedId} onSelect={onSelect} />
            ))}
          </div>
        )}
        {filtered.length === 0 && (
          <div className="p-3 text-xs text-muted-foreground text-center">Ничего не найдено</div>
        )}
      </div>
    </div>
  );
}

function ItemRow({ item, selected, onSelect }: { item: NomenclatureItem; selected: boolean; onSelect: (id: string) => void }) {
  return (
    <button
      className={`w-full text-left px-3 py-2 text-xs border-b border-border/50 transition-colors ${
        selected ? "bg-accent" : "hover:bg-accent/50"
      }`}
      onClick={() => onSelect(item.id)}
    >
      <div className="flex items-center gap-1.5">
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${typeColors[item.type]}`}>
          {itemTypeLabels[item.type]}
        </Badge>
        <span className="truncate text-foreground">{item.name}</span>
      </div>
      <span className="text-muted-foreground text-[10px] font-mono">{item.code}</span>
    </button>
  );
}
