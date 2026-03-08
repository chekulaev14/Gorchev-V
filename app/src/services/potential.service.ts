import { prisma } from "@/lib/prisma";
import { toNumber } from "@/services/helpers/serialize";
import type { PotentialItem, Bottleneck } from "@/lib/types";

interface BomLink {
  childId: string;
  quantity: number;
}

interface ItemInfo {
  id: string;
  name: string;
  typeId: string;
  unitId: string;
}

interface PotentialResult {
  potential: number;
  canProduce: number;
  bottleneck: Bottleneck | null;
}

type ChildrenMap = Map<string, BomLink[]>;
type BalancesMap = Map<string, number>;
type ItemsMap = Map<string, ItemInfo>;
type Memo = Map<string, PotentialResult>;

function buildBomGraph(entries: { parentId: string; childId: string; quantity: unknown }[]) {
  const childrenMap: ChildrenMap = new Map();

  for (const e of entries) {
    const qty = toNumber(e.quantity as number) ?? 0;

    if (!childrenMap.has(e.parentId)) childrenMap.set(e.parentId, []);
    childrenMap.get(e.parentId)!.push({ childId: e.childId, quantity: qty });
  }

  return { childrenMap };
}

function calculateItemPotential(
  itemId: string,
  childrenMap: ChildrenMap,
  balances: BalancesMap,
  memo: Memo,
  visiting: Set<string>,
): PotentialResult {
  if (memo.has(itemId)) return memo.get(itemId)!;

  const balance = balances.get(itemId) ?? 0;
  const children = childrenMap.get(itemId);

  if (!children || children.length === 0) {
    const result: PotentialResult = { potential: balance, canProduce: 0, bottleneck: null };
    memo.set(itemId, result);
    return result;
  }

  if (visiting.has(itemId)) {
    const result: PotentialResult = { potential: balance, canProduce: 0, bottleneck: null };
    memo.set(itemId, result);
    return result;
  }

  visiting.add(itemId);

  let minCanMake = Infinity;
  let bottleneck: Bottleneck | null = null;

  for (const child of children) {
    const childResult = calculateItemPotential(child.childId, childrenMap, balances, memo, visiting);
    const canMake = child.quantity > 0 ? Math.floor(childResult.potential / child.quantity) : 0;

    if (canMake < minCanMake) {
      minCanMake = canMake;

      if (childResult.bottleneck) {
        bottleneck = {
          ...childResult.bottleneck,
          neededPerUnit: childResult.bottleneck.neededPerUnit * child.quantity,
        };
      } else {
        bottleneck = {
          itemId: child.childId,
          name: "",
          balance: childResult.potential,
          neededPerUnit: child.quantity,
        };
      }
    }
  }

  visiting.delete(itemId);

  const canProduce = minCanMake === Infinity ? 0 : minCanMake;
  const result: PotentialResult = {
    potential: balance + canProduce,
    canProduce,
    bottleneck,
  };
  memo.set(itemId, result);
  return result;
}

export async function calculateAllPotentials(filterItemId?: string): Promise<PotentialItem[]> {
  const [bomEntries, stockBalances, items] = await Promise.all([
    prisma.bomEntry.findMany({
      where: { parent: { deletedAt: null }, child: { deletedAt: null } },
      select: { parentId: true, childId: true, quantity: true },
    }),
    prisma.stockBalance.findMany({
      select: { itemId: true, quantity: true },
    }),
    prisma.item.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, typeId: true, unitId: true },
    }),
  ]);

  const { childrenMap } = buildBomGraph(bomEntries);

  const balances: BalancesMap = new Map();
  for (const sb of stockBalances) {
    balances.set(sb.itemId, toNumber(sb.quantity) ?? 0);
  }

  const itemsMap: ItemsMap = new Map();
  for (const item of items) {
    itemsMap.set(item.id, item);
  }

  const memo: Memo = new Map();
  const results: PotentialItem[] = [];

  const nonMaterialItems = items.filter((i) => i.typeId !== "material");

  const targetItems = filterItemId
    ? items.filter((i) => i.id === filterItemId)
    : nonMaterialItems;

  for (const item of targetItems) {
    const potResult = calculateItemPotential(item.id, childrenMap, balances, memo, new Set());

    if (potResult.bottleneck && !potResult.bottleneck.name) {
      const info = itemsMap.get(potResult.bottleneck.itemId);
      if (info) potResult.bottleneck.name = info.name;
    }

    results.push({
      itemId: item.id,
      name: item.name,
      type: item.typeId as PotentialItem["type"],
      unit: item.unitId as PotentialItem["unit"],
      balance: balances.get(item.id) ?? 0,
      potential: potResult.potential,
      canProduce: potResult.canProduce,
      bottleneck: potResult.bottleneck,
    });
  }

  return results;
}
