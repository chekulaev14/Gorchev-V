import { prisma } from '@/lib/prisma';
import { ServiceError } from '@/lib/api/handle-route-error';
import { log } from '@/lib/logger';
import type { CreateDraftInput, UpdateDraftInput } from '@/lib/schemas/constructor-draft.schema';

export async function getDrafts() {
  log.info('constructor-draft: getDrafts');
  return prisma.constructorDraft.findMany({
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      name: true,
      status: true,
      routingId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function getDraft(id: string) {
  const draft = await prisma.constructorDraft.findUnique({ where: { id } });
  if (!draft) throw new ServiceError('Черновик не найден', 404);
  return draft;
}

export async function createDraft(input: CreateDraftInput, userId?: string) {
  log.info('constructor-draft: createDraft', { name: input.name });
  return prisma.constructorDraft.create({
    data: {
      name: input.name,
      state: input.state as object,
      createdById: userId ?? null,
    },
  });
}

export async function updateDraft(id: string, input: UpdateDraftInput) {
  const draft = await prisma.constructorDraft.findUnique({ where: { id } });
  if (!draft) throw new ServiceError('Черновик не найден', 404);
  if (draft.status !== 'DRAFT') {
    throw new ServiceError('Можно редактировать только черновик', 400);
  }

  log.info('constructor-draft: updateDraft', { id });
  return prisma.constructorDraft.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.state !== undefined && { state: input.state as object }),
    },
  });
}

export async function deleteDraft(id: string) {
  const draft = await prisma.constructorDraft.findUnique({ where: { id } });
  if (!draft) throw new ServiceError('Черновик не найден', 404);
  if (draft.status !== 'DRAFT') {
    throw new ServiceError('Нельзя удалить опубликованный черновик', 400);
  }

  log.info('constructor-draft: deleteDraft', { id });
  return prisma.constructorDraft.delete({ where: { id } });
}
