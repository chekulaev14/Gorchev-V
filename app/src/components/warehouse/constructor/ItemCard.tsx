"use client";

import type { NomenclatureItem } from "@/lib/types";
import { unitLabels, itemTypeLabels } from "@/lib/constants";

const badgeColors: Record<string, string> = {
  material: "bg-amber-100 text-amber-800",
  blank: "bg-blue-100 text-blue-800",
  product: "bg-emerald-100 text-emerald-800",
};

const cardBorderColors: Record<string, string> = {
  material: "border-amber-300",
  blank: "border-blue-300",
  product: "border-emerald-400 bg-emerald-50",
};

interface ItemCardProps {
  item: NomenclatureItem;
  quantity?: number;
  weight?: number | null;
  onQuantityChange?: (qty: number) => void;
  onWeightChange?: (weight: number) => void;
  onRemove?: () => void;
  isSelected?: boolean;
  isLinkTarget?: boolean;
  onClick?: () => void;
  cardId: string;
  potential?: number | null;
  balance?: number | null;
}

export function ItemCard({
  item,
  quantity,
  weight,
  onQuantityChange,
  onWeightChange,
  onRemove,
  isSelected,
  isLinkTarget,
  onClick,
  cardId,
  potential,
  balance,
}: ItemCardProps) {
  const type = item.type;
  const isProduct = type === "product";
  const isMaterial = type === "material";
  const isBlank = type === "blank";

  let borderClass = cardBorderColors[type] || "border-border";
  if (isSelected) borderClass += " ring-2 ring-blue-400/50 border-blue-500";
  else if (isLinkTarget) borderClass += " ring-2 ring-blue-300/30";

  return (
    <div
      data-card-id={cardId}
      onClick={onClick}
      className={`relative border-[1.5px] ${borderClass} rounded-lg px-3 py-2.5 bg-white mb-2 last:mb-0 transition-all ${
        onClick && !isProduct ? "cursor-pointer hover:border-gray-400" : ""
      } ${isProduct ? "cursor-default" : ""}`}
    >
      {onRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-100 border border-red-300 text-red-600 text-[10px] leading-[14px] text-center hover:bg-red-200 transition-colors z-10"
        >
          x
        </button>
      )}

      {/* Коннектор справа (для связывания) */}
      {!isProduct && (
        <span className={`absolute right-[-7px] top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white z-[3] transition-colors ${
          isSelected ? "bg-blue-500" : "bg-gray-300 group-hover:bg-blue-300"
        }`} />
      )}

      {/* Коннектор слева */}
      {type !== "material" && (
        <span className={`absolute left-[-7px] top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white z-[3] transition-colors ${
          isLinkTarget ? "bg-blue-300" : "bg-gray-300"
        }`} />
      )}

      <div className="flex items-center gap-1.5">
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${badgeColors[type]}`}>
          {itemTypeLabels[type]}
        </span>
        <span className="text-sm font-medium">{item.name}</span>
      </div>

      {/* Сырьё: артикул + остаток */}
      {isMaterial && (
        <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2">
          <span>{item.code}</span>
          {balance != null && (
            <>
              <span style={{ color: "#ccc" }}>·</span>
              <span>остаток: {balance} {unitLabels[item.unit]}</span>
            </>
          )}
        </div>
      )}

      {/* Заготовка: артикул + вес + количество + потенциал */}
      {isBlank && (
        <>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            <span>{item.code}</span>
          </div>
          <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
            {onWeightChange && weight != null ? (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-gray-400">вес:</span>
                <input
                  type="number"
                  value={weight}
                  onChange={(e) => onWeightChange(Number(e.target.value))}
                  onClick={(e) => e.stopPropagation()}
                  className="w-14 text-center text-[11px] font-medium border border-input rounded px-1 py-0.5 bg-background"
                  min={0.01}
                  step="0.01"
                />
                <span>кг</span>
              </div>
            ) : weight != null ? (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-gray-400">вес:</span>
                <span className="font-medium">{weight} кг</span>
              </div>
            ) : null}
            {onQuantityChange && quantity !== undefined ? (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-gray-400">кол-во:</span>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => onQuantityChange(Number(e.target.value))}
                  onClick={(e) => e.stopPropagation()}
                  className="w-14 text-center text-[11px] font-medium border border-input rounded px-1 py-0.5 bg-background"
                  min={1}
                  step="1"
                />
                <span>шт</span>
              </div>
            ) : quantity !== undefined ? (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-gray-400">кол-во:</span>
                <span className="font-medium">{quantity} шт</span>
              </div>
            ) : null}
          </div>
          {potential != null && (
            <div className="text-[9px] font-medium text-green-600 mt-1">
              потенциал: {potential} шт
            </div>
          )}
          {potential == null && weight != null && (
            <div className="text-[9px] text-gray-400 mt-1">
              нет связи с сырьём
            </div>
          )}
        </>
      )}

      {/* Изделие: только артикул */}
      {isProduct && (
        <div className="text-[11px] text-muted-foreground mt-0.5">
          <span>{item.code}</span>
        </div>
      )}
    </div>
  );
}
