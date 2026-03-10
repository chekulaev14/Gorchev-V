import { prisma } from "@/lib/prisma";
import { toNumber } from "@/services/helpers/serialize";
import type { PotentialItem, Bottleneck, PotentialBreakdown } from "@/lib/types";

interface ItemInfo {
  id: string;
  name: string;
  typeId: string;
  unitId: string;
}

type BomChild = { childId: string; quantity: number };
type BomMap = Map<string, BomChild[]>;
type BalancesMap = Map<string, number>;
type ItemsMap = Map<string, ItemInfo>;

interface ComputeResult {
  available: number;
  canProduce: number;
  bottleneck: Bottleneck | null;
  chain: PotentialBreakdown[];
}

function buildBomMap(entries: { parentId: string; childId: string; quantity: unknown }[]): BomMap {
  const map: BomMap = new Map();

  for (const e of entries) {
    const qty = toNumber(e.quantity as number) ?? 0;
    if (qty <= 0) continue;

    if (!map.has(e.parentId)) map.set(e.parentId, []);
    map.get(e.parentId)!.push({ childId: e.childId, quantity: qty });
  }

  return map;
}

/**
 * Рекурсивно считает доступное количество позиции:
 * available = balance + canProduce (из компонентов по BOM)
 */
function computeAvailable(
  itemId: string,
  bomMap: BomMap,
  balances: BalancesMap,
  itemsMap: ItemsMap,
  visited: Set<string>,
): ComputeResult {
  if (visited.has(itemId)) {
    return { available: 0, canProduce: 0, bottleneck: null, chain: [] };
  }
  visited.add(itemId);

  const balance = balances.get(itemId) ?? 0;
  const children = bomMap.get(itemId);

  if (!children || children.length === 0) {
    return { available: balance, canProduce: 0, bottleneck: null, chain: [] };
  }

  let minCanProduce = Infinity;
  let bottleneck: Bottleneck | null = null;
  const chain: PotentialBreakdown[] = [];

  for (const child of children) {
    const childResult = computeAvailable(child.childId, bomMap, balances, itemsMap, new Set(visited));
    const canProduceFromChild = Math.floor(childResult.available / child.quantity);
    const childInfo = itemsMap.get(child.childId);

    chain.push({
      itemId: child.childId,
      name: childInfo?.name ?? "",
      quantity: canProduceFromChild,
      balance: balances.get(child.childId) ?? 0,
      neededPerUnit: child.quantity,
    });

    if (canProduceFromChild < minCanProduce) {
      minCanProduce = canProduceFromChild;
      bottleneck = {
        itemId: child.childId,
        name: childInfo?.name ?? "",
        balance: childResult.available,
        neededPerUnit: child.quantity,
      };
    }
  }

  const canProduce = minCanProduce === Infinity ? 0 : minCanProduce;

  return {
    available: balance + canProduce,
    canProduce,
    bottleneck,
    chain,
  };
}

export async function calculateAllPotentials(filterItemId?: string): Promise<PotentialItem[]> {
  const [bomEntries, stockBalances, items] = await Promise.all([
    prisma.bomEntry.findMany({
      where: { parent: { deletedAt: null }, child: { deletedAt: null } },
      select: { parentId: true, childId: true, quantity: true },
    }),
    prisma.stockBalance.findMany({
      where: { locationId: "MAIN" },
      select: { itemId: true, quantity: true },
    }),
    prisma.item.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, typeId: true, unitId: true },
    }),
  ]);

  const bomMap = buildBomMap(bomEntries);

  const balances: BalancesMap = new Map();
  for (const sb of stockBalances) {
    balances.set(sb.itemId, toNumber(sb.quantity) ?? 0);
  }

  const itemsMap: ItemsMap = new Map();
  for (const item of items) {
    itemsMap.set(item.id, {
      id: item.id,
      name: item.name,
      typeId: item.typeId,
      unitId: item.unitId,
    });
  }

  const nonMaterialItems = items.filter((i) => i.typeId !== "material");

  const targetItems = filterItemId
    ? items.filter((i) => i.id === filterItemId)
    : nonMaterialItems;

  const results: PotentialItem[] = [];

  for (const item of targetItems) {
    const balance = balances.get(item.id) ?? 0;
    const result = computeAvailable(item.id, bomMap, balances, itemsMap, new Set());

    results.push({
      itemId: item.id,
      name: item.name,
      type: item.typeId as PotentialItem["type"],
      unit: item.unitId as PotentialItem["unit"],
      balance,
      potential: balance + result.canProduce,
      canProduce: result.canProduce,
      bottleneck: result.bottleneck,
      breakdown: filterItemId ? result.chain : undefined,
    });
  }

  return results;
}
