import { prisma } from "@/lib/prisma";
import { mapItem } from "./helpers/map-item";
import { toNumber } from "./helpers/serialize";

export async function getAllEntries() {
  const entries = await prisma.bomEntry.findMany({
    where: {
      parent: { deletedAt: null },
      child: { deletedAt: null },
    },
    include: { child: true },
  });
  return entries.map((e) => ({
    parentId: e.parentId,
    childId: e.childId,
    quantity: toNumber(e.quantity),
    child: mapItem(e.child),
  }));
}

export async function getChildren(parentId: string) {
  const entries = await prisma.bomEntry.findMany({
    where: { parentId, child: { deletedAt: null } },
    include: { child: true },
  });
  return entries.map((e) => ({ item: mapItem(e.child), quantity: toNumber(e.quantity) }));
}

export async function getParents(childId: string) {
  const entries = await prisma.bomEntry.findMany({
    where: { childId, parent: { deletedAt: null } },
    include: { parent: true },
  });
  return entries.map((e) => ({ item: mapItem(e.parent), quantity: toNumber(e.quantity) }));
}

export async function addEntry(parentId: string, childId: string, quantity: number) {
  if (parentId === childId) {
    throw new Error("Позиция не может быть компонентом самой себя");
  }

  await checkForCycle(parentId, childId);

  return prisma.bomEntry.upsert({
    where: { parentId_childId: { parentId, childId } },
    update: { quantity },
    create: { parentId, childId, quantity },
  });
}

async function checkForCycle(parentId: string, childId: string): Promise<void> {
  const visited = new Set<string>();
  const queue = [parentId];

  while (queue.length > 0) {
    const current = queue.pop()!;
    if (current === childId) {
      throw new Error("Обнаружен цикл: добавление этой связи создаст циклическую зависимость в BOM");
    }
    if (visited.has(current)) continue;
    visited.add(current);

    const parents = await prisma.bomEntry.findMany({
      where: { childId: current },
      select: { parentId: true },
    });
    for (const p of parents) {
      queue.push(p.parentId);
    }
  }
}

export async function updateEntry(parentId: string, childId: string, quantity: number) {
  await checkForCycle(parentId, childId);

  return prisma.bomEntry.update({
    where: { parentId_childId: { parentId, childId } },
    data: { quantity },
  });
}

export async function deleteEntry(parentId: string, childId: string) {
  await prisma.bomEntry.delete({
    where: { parentId_childId: { parentId, childId } },
  });
}

