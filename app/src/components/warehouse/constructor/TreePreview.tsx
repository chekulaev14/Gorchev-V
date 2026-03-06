"use client";

import { Badge } from "@/components/ui/badge";
import type { ItemType } from "@/lib/types";
import { itemTypeLabels, unitLabels, typeColors } from "@/lib/constants";
import type { ConstructorItem } from "./ConstructorWizard";

interface ProductData {
  name: string;
  unit: string;
  description: string;
}

interface TreeNode {
  tempId: string;
  name: string;
  type: ItemType;
  unit: string;
  quantity?: string;
  children: TreeNode[];
  isPaired?: boolean;
}

function buildTree(
  productTempId: string,
  product: ProductData,
  blanks: ConstructorItem[],
  materials: ConstructorItem[]
): TreeNode {
  const allItems: { item: ConstructorItem; type: ItemType }[] = [
    ...blanks.map((i) => ({ item: i, type: "blank" as ItemType })),
    ...materials.map((i) => ({ item: i, type: "material" as ItemType })),
  ];

  function getChildren(parentTempId: string): TreeNode[] {
    return allItems
      .filter((entry) => entry.item.parentTempId === parentTempId && entry.item.name)
      .map((entry) => ({
        tempId: entry.item.tempId,
        name: entry.item.name,
        type: entry.type,
        unit: entry.item.unit,
        quantity: entry.item.quantity,
        children: getChildren(entry.item.tempId),
        isPaired: entry.item.isPaired,
      }));
  }

  return {
    tempId: productTempId,
    name: product.name || "Новое изделие",
    type: "product",
    unit: product.unit,
    children: getChildren(productTempId),
  };
}

function buildPairedTree(
  tree: TreeNode,
  side: "left" | "right",
  productName: string
): TreeNode {
  const suffix = side === "left" ? " левое" : " правое";
  const blankSuffix = side === "left" ? " левая" : " правая";

  function mapChildren(children: TreeNode[]): TreeNode[] {
    return children.map((child) => ({
      ...child,
      name: child.isPaired ? child.name + blankSuffix : child.name,
      children: mapChildren(child.children),
    }));
  }

  return {
    ...tree,
    name: (productName || "Новое изделие") + suffix,
    children: mapChildren(tree.children),
  };
}

function TreeNodeView({ node, depth = 0 }: { node: TreeNode; depth?: number }) {
  return (
    <div>
      <div
        className="flex items-center gap-1.5 py-1"
        style={{ paddingLeft: `${depth * 16}px` }}
      >
        {depth > 0 && (
          <span className="text-border text-xs">└</span>
        )}
        <Badge
          variant="outline"
          className={`text-[10px] px-1.5 py-0 shrink-0 ${typeColors[node.type]}`}
        >
          {itemTypeLabels[node.type].slice(0, 3)}
        </Badge>
        <span className="text-xs text-foreground truncate">{node.name}</span>
        {node.quantity && depth > 0 && (
          <span className="text-[10px] text-muted-foreground shrink-0">
            ×{node.quantity} {unitLabels[node.unit as keyof typeof unitLabels] || node.unit}
          </span>
        )}
      </div>
      {node.children.map((child) => (
        <TreeNodeView key={child.tempId} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

function UnlinkedItems({
  blanks,
  materials,
  isPaired,
}: {
  blanks: ConstructorItem[];
  materials: ConstructorItem[];
  isPaired: boolean;
}) {
  const unlinkedBlanks = blanks.filter((i) => i.name && !i.parentTempId);
  const unlinkedMaterials = materials.filter((i) => i.name && !i.parentTempId);

  if (unlinkedBlanks.length === 0 && unlinkedMaterials.length === 0) return null;

  const items: { name: string; type: ItemType; isPaired: boolean }[] = [
    ...unlinkedBlanks.map((i) => ({ name: i.name, type: "blank" as ItemType, isPaired: i.isPaired })),
    ...unlinkedMaterials.map((i) => ({ name: i.name, type: "material" as ItemType, isPaired: i.isPaired })),
  ];

  return (
    <div className="border-t border-dashed border-border pt-2 mt-2">
      <p className="text-[10px] text-muted-foreground mb-1">Не привязано:</p>
      {items.map((item, idx) => (
        <div key={idx}>
          {isPaired && item.isPaired ? (
            <>
              <div className="flex items-center gap-1.5 py-0.5 pl-2">
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${typeColors[item.type]}`}>
                  {itemTypeLabels[item.type].slice(0, 3)}
                </Badge>
                <span className="text-xs text-foreground truncate">{item.name} левая</span>
              </div>
              <div className="flex items-center gap-1.5 py-0.5 pl-2">
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${typeColors[item.type]}`}>
                  {itemTypeLabels[item.type].slice(0, 3)}
                </Badge>
                <span className="text-xs text-foreground truncate">{item.name} правая</span>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-1.5 py-0.5 pl-2">
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${typeColors[item.type]}`}>
                {itemTypeLabels[item.type].slice(0, 3)}
              </Badge>
              <span className="text-xs text-foreground truncate">{item.name}</span>
              {item.isPaired && (
                <span className="text-[10px] text-blue-500 shrink-0">лев/прав</span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function TreePreview({
  product,
  productTempId,
  blanks,
  materials,
  isPaired = false,
}: {
  product: ProductData;
  productTempId: string;
  blanks: ConstructorItem[];
  materials: ConstructorItem[];
  isPaired?: boolean;
}) {
  const tree = buildTree(productTempId, product, blanks, materials);

  if (!product.name && blanks.length === 0 && materials.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-2">
        Начните заполнять данные
      </p>
    );
  }

  if (isPaired) {
    const leftTree = buildPairedTree(tree, "left", product.name);
    const rightTree = buildPairedTree(tree, "right", product.name);
    return (
      <div>
        <div className="space-y-2">
          <TreeNodeView node={leftTree} />
          <div className="border-t border-border" />
          <TreeNodeView node={rightTree} />
        </div>
        <UnlinkedItems blanks={blanks} materials={materials} isPaired={isPaired} />
      </div>
    );
  }

  return (
    <div>
      <TreeNodeView node={tree} />
      <UnlinkedItems blanks={blanks} materials={materials} isPaired={isPaired} />
    </div>
  );
}
