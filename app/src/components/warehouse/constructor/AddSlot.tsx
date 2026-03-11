"use client";

import { SearchableSelect } from "@/components/ui/searchable-select";
import type { NomenclatureItem } from "@/lib/types";
import { itemTypeLabels } from "@/lib/constants";

const badgeColors: Record<string, string> = {
  material: "bg-amber-100 text-amber-800",
  blank: "bg-blue-100 text-blue-800",
  product: "bg-emerald-100 text-emerald-800",
};

interface AddSlotProps {
  items: NomenclatureItem[];
  onSelect: (id: string) => void;
  placeholder: string;
}

export function AddSlot({ items, onSelect, placeholder }: AddSlotProps) {
  return (
    <div className="border-[1.5px] border-dashed border-muted-foreground/30 bg-muted/20 rounded-lg p-2 mb-2 last:mb-0">
      <SearchableSelect
        items={items}
        value={null}
        onChange={(id) => id && onSelect(id)}
        getKey={(i) => i.id}
        getLabel={(i) => i.name}
        placeholder={placeholder}
        renderItem={(i) => (
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${badgeColors[i.type]}`}>
              {itemTypeLabels[i.type]}
            </span>
            <span>{i.name}</span>
            <span className="text-xs text-muted-foreground ml-auto">{i.code}</span>
          </div>
        )}
      />
    </div>
  );
}
