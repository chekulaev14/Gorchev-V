import { prisma } from "@/lib/prisma";

export async function getGroups() {
  return prisma.processGroup.findMany({
    include: { processes: { orderBy: { order: "asc" } } },
    orderBy: { order: "asc" },
  });
}

function toId(name: string) {
  return name.toLowerCase().replace(/[^a-zа-яё0-9]/gi, "-").replace(/-+/g, "-");
}

export async function createGroup(data: { id?: string; name: string; order?: number }) {
  const id = data.id?.trim() || toId(data.name);
  return prisma.processGroup.create({
    data: { id, name: data.name, order: data.order ?? 0 },
  });
}

export async function createProcess(data: { name: string; groupId: string }) {
  const maxOrder = await prisma.process.aggregate({
    where: { groupId: data.groupId },
    _max: { order: true },
  });
  const nextOrder = (maxOrder._max.order ?? 0) + 1;
  const id = toId(data.name);

  return prisma.process.create({
    data: { id, name: data.name, groupId: data.groupId, order: nextOrder },
  });
}

export async function updateProcess(id: string, name: string) {
  return prisma.process.update({ where: { id }, data: { name } });
}

export async function updateGroup(id: string, name: string) {
  return prisma.processGroup.update({ where: { id }, data: { name } });
}

export async function deleteProcess(id: string) {
  await prisma.process.delete({ where: { id } });
}

export async function deleteGroup(id: string) {
  await prisma.process.deleteMany({ where: { groupId: id } });
  await prisma.processGroup.delete({ where: { id } });
}
