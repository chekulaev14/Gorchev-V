"use client";

import { Badge } from "@/components/ui/badge";
import type { ItemType } from "@/lib/types";
import { itemTypeLabels, unitLabels, typeColors } from "@/lib/constants";
import type { ConstructorItem, ProductData } from "./wizard-reducer";

interface SummaryStepProps {
  product: ProductData;
  productTempId: string;
  blanks: ConstructorItem[];
  materials: ConstructorItem[];
  isPaired: boolean;
}

export function SummaryStep({
  product,
  productTempId,
  blanks,
  materials,
  isPaired,
}: SummaryStepProps) {
  const allItems = [
    ...materials.filter((i) => i.name),
    ...blanks.filter((i) => i.name),
  ];

  const newItems = allItems.filter((i) => !i.existingId);
  const existingItems = allItems.filter((i) => i.existingId);
  const linkedItems = allItems.filter((i) => i.parentTempId);
  const pairedBlanks = blanks.filter((i) => i.name && i.isPaired);

  const counts = {
    material: materials.filter((i) => i.name).length,
    blank: blanks.filter((i) => i.name).length,
  };

  const productCount = isPaired ? 2 : 1;
  const extraPairedItems = isPaired ? pairedBlanks.length : 0;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-foreground">Итоговая сводка</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Проверьте структуру перед созданием
        </p>
      </div>

      {isPaired && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-2.5">
          <p className="text-xs text-blue-700 font-medium">Парная деталь</p>
          <p className="text-[11px] text-blue-600 mt-0.5">
            Будет создано 2 изделия (левое/правое){pairedBlanks.length > 0 && `, ${pairedBlanks.length} заготовок продублировано`}.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {(["material", "blank"] as const).map((type) => (
          <div key={type} className="rounded-lg border border-border bg-card p-2.5 text-center">
            <p className="text-lg font-semibold text-foreground">{counts[type]}</p>
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${typeColors[type]}`}>
              {itemTypeLabels[type]}
            </Badge>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="outline" className={`text-xs px-2 py-0 ${typeColors.product}`}>
            {itemTypeLabels.product}
          </Badge>
          <span className="text-sm font-medium text-foreground">
            {isPaired ? `${product.name} (Л/П)` : product.name}
          </span>
          <span className="text-xs text-muted-foreground">
            ({unitLabels[product.unit as keyof typeof unitLabels]})
          </span>
        </div>
        {product.weight && (
          <p className="text-xs text-muted-foreground">Вес: {product.weight} кг</p>
        )}
        {product.description && (
          <p className="text-xs text-muted-foreground">{product.description}</p>
        )}
      </div>

      {allItems.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-4 text-center">
          <p className="text-sm text-muted-foreground">
            Не добавлено ни одного компонента. Изделие будет создано без BOM-связей.
          </p>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Будет создано: {productCount} {productCount === 2 ? "изделия" : "изделие"}, {newItems.length + extraPairedItems} новых компонентов, {existingItems.length} привязано из базы, {linkedItems.length * productCount} BOM-связей.
      </p>
    </div>
  );
}
