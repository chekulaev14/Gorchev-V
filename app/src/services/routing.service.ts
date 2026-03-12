import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/lib/api/handle-route-error";
import { toNumber } from "./helpers/serialize";
import type { StepPayload } from "@/lib/schemas/routing.schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

const ITEM_SELECT = { id: true, name: true, code: true, typeId: true, unitId: true, side: true } as const;

const STEP_INCLUDE = {
  process: { select: { id: true, name: true } },
  outputItem: { select: ITEM_SELECT },
  inputs: {
    orderBy: { sortOrder: "asc" as const },
    include: { item: { select: ITEM_SELECT } },
  },
} as const;

// --- Helpers ---

function serializeStep(s: { outputQty: unknown; normTimeMin: unknown; setupTimeMin: unknown; inputs: { qty: unknown }[] }) {
  return {
    ...s,
    outputQty: toNumber(s.outputQty as number),
    normTimeMin: toNumber(s.normTimeMin as number | null),
    setupTimeMin: toNumber(s.setupTimeMin as number | null),
    inputs: s.inputs.map((inp) => ({
      ...inp,
      qty: toNumber(inp.qty as number),
    })),
  };
}

// --- Read ---

/** Найти активный маршрут по конечному изделию */
export async function getActiveRoutingByItem(itemId: string) {
  const routing = await prisma.routing.findFirst({
    where: { itemId, status: "ACTIVE" },
    include: { steps: { orderBy: { stepNo: "asc" }, include: STEP_INCLUDE } },
  });
  if (!routing) return null;

  return { ...routing, steps: routing.steps.map(serializeStep) };
}

/** Найти все маршруты позиции (все статусы) */
export async function getRoutingsByItem(itemId: string) {
  const routings = await prisma.routing.findMany({
    where: { itemId },
    include: { steps: { orderBy: { stepNo: "asc" }, include: STEP_INCLUDE } },
    orderBy: { version: "desc" },
  });

  return routings.map((r) => ({ ...r, steps: r.steps.map(serializeStep) }));
}

/**
 * Найти producing step для конкретного outputItemId среди ACTIVE маршрутов.
 * Инвариант: ровно один producing step на outputItemId.
 */
export async function getProducingStep(outputItemId: string, tx?: Tx) {
  const client = tx ?? prisma;
  const steps = await client.routingStep.findMany({
    where: { outputItemId, routing: { status: "ACTIVE" } },
    include: {
      routing: { select: { id: true, itemId: true, status: true } },
      process: { select: { id: true, name: true } },
      outputItem: { select: { id: true, name: true, code: true } },
      inputs: {
        orderBy: { sortOrder: "asc" },
        include: { item: { select: { id: true, name: true, code: true } } },
      },
    },
  });

  if (steps.length === 0) return null;
  if (steps.length > 1) {
    throw new ServiceError(
      `Несколько producing steps для ${outputItemId} — ошибка данных`,
      500,
    );
  }

  const s = steps[0];
  return {
    ...s,
    outputQty: toNumber(s.outputQty),
    inputs: s.inputs.map((inp) => ({
      ...inp,
      qty: toNumber(inp.qty),
    })),
  };
}

// --- Write ---

/** Создать маршрут (DRAFT) */
export async function createRouting(itemId: string, steps: StepPayload[]) {
  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item) throw new ServiceError("Позиция не найдена", 404);

  validateSteps(steps, itemId);

  const maxVersion = await prisma.routing.aggregate({
    where: { itemId },
    _max: { version: true },
  });
  const nextVersion = (maxVersion._max.version ?? 0) + 1;

  return prisma.routing.create({
    data: {
      itemId,
      version: nextVersion,
      status: "DRAFT",
      steps: {
        create: steps.map((s) => ({
          stepNo: s.stepNo,
          processId: s.processId,
          outputItemId: s.outputItemId,
          outputQty: s.outputQty,
          normTimeMin: s.normTimeMin ?? null,
          setupTimeMin: s.setupTimeMin ?? null,
          note: s.note ?? null,
          inputs: {
            create: s.inputs.map((inp) => ({
              itemId: inp.itemId,
              qty: inp.qty,
              sortOrder: inp.sortOrder,
            })),
          },
        })),
      },
    },
    include: { steps: { orderBy: { stepNo: "asc" }, include: STEP_INCLUDE } },
  });
}

/** Обновить шаги черновика (полная перезапись) */
export async function updateRoutingSteps(routingId: string, steps: StepPayload[]) {
  const routing = await prisma.routing.findUnique({ where: { id: routingId } });
  if (!routing) throw new ServiceError("Маршрут не найден", 404);
  if (routing.status !== "DRAFT") {
    throw new ServiceError("Можно редактировать только черновик", 400);
  }

  validateSteps(steps, routing.itemId);

  return prisma.$transaction(async (tx) => {
    await tx.routingStep.deleteMany({ where: { routingId } });

    for (const s of steps) {
      await tx.routingStep.create({
        data: {
          routingId,
          stepNo: s.stepNo,
          processId: s.processId,
          outputItemId: s.outputItemId,
          outputQty: s.outputQty,
          normTimeMin: s.normTimeMin ?? null,
          setupTimeMin: s.setupTimeMin ?? null,
          note: s.note ?? null,
          inputs: {
            create: s.inputs.map((inp) => ({
              itemId: inp.itemId,
              qty: inp.qty,
              sortOrder: inp.sortOrder,
            })),
          },
        },
      });
    }

    return tx.routing.findUnique({
      where: { id: routingId },
      include: { steps: { orderBy: { stepNo: "asc" }, include: STEP_INCLUDE } },
    });
  });
}

/** DRAFT → ACTIVE, архивировать предыдущий */
export async function activateRouting(routingId: string) {
  return prisma.$transaction(async (tx) => {
    const routing = await tx.routing.findUnique({
      where: { id: routingId },
      include: {
        steps: {
          include: {
            outputItem: true,
            inputs: true,
          },
        },
      },
    });
    if (!routing) throw new ServiceError("Маршрут не найден", 404);
    if (routing.status === "ACTIVE") return routing;
    if (routing.status === "ARCHIVED") {
      throw new ServiceError("Нельзя активировать архивный маршрут", 400);
    }
    if (routing.steps.length === 0) {
      throw new ServiceError("Нельзя активировать пустой маршрут", 400);
    }

    // Проверить что все шаги заполнены
    for (const s of routing.steps) {
      if (!s.outputItemId || !s.outputQty) {
        throw new ServiceError(`Шаг ${s.stepNo} не полностью заполнен`, 400);
      }
      if (s.inputs.length === 0) {
        throw new ServiceError(`Шаг ${s.stepNo} не имеет входов`, 400);
      }
    }

    // Проверка: для каждого outputItemId не должно быть другого ACTIVE producing step
    for (const s of routing.steps) {
      const existing = await tx.routingStep.findMany({
        where: {
          outputItemId: s.outputItemId,
          routing: { status: "ACTIVE", id: { not: routingId } },
        },
      });
      if (existing.length > 0) {
        throw new ServiceError(
          `Для ${s.outputItem?.name ?? s.outputItemId} уже есть активный маршрут`,
          409,
        );
      }
    }

    // Архивируем текущий ACTIVE
    await tx.routing.updateMany({
      where: { itemId: routing.itemId, status: "ACTIVE" },
      data: { status: "ARCHIVED" },
    });

    // Активируем новый
    await tx.routing.update({
      where: { id: routingId },
      data: { status: "ACTIVE" },
    });

    return tx.routing.findUnique({
      where: { id: routingId },
      include: { steps: { orderBy: { stepNo: "asc" }, include: STEP_INCLUDE } },
    });
  });
}

/** Архивировать маршрут */
export async function archiveRouting(routingId: string) {
  const routing = await prisma.routing.findUnique({ where: { id: routingId } });
  if (!routing) throw new ServiceError("Маршрут не найден", 404);
  if (routing.status === "ACTIVE") {
    throw new ServiceError("Нельзя архивировать активный маршрут — сначала активируйте другой", 400);
  }
  return prisma.routing.update({
    where: { id: routingId },
    data: { status: "ARCHIVED" },
  });
}

/** Удалить черновик */
export async function deleteRouting(routingId: string) {
  const routing = await prisma.routing.findUnique({ where: { id: routingId } });
  if (!routing) throw new ServiceError("Маршрут не найден", 404);
  if (routing.status !== "DRAFT") {
    throw new ServiceError("Можно удалить только черновик", 400);
  }
  return prisma.routing.delete({ where: { id: routingId } });
}

// --- Validation ---

function validateSteps(steps: StepPayload[], itemId: string) {
  if (steps.length === 0) {
    throw new ServiceError("Маршрут должен содержать хотя бы один шаг", 400);
  }

  const sorted = [...steps].sort((a, b) => a.stepNo - b.stepNo);

  // stepNo непрерывные 1..N
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].stepNo !== i + 1) {
      throw new ServiceError(`stepNo должны быть непрерывными (1..N), нарушение на шаге ${sorted[i].stepNo}`, 400);
    }
  }

  // Последний шаг: outputItem = itemId маршрута
  const lastStep = sorted[sorted.length - 1];
  if (lastStep.outputItemId !== itemId) {
    throw new ServiceError("Выход последнего шага должен совпадать с конечным изделием маршрута", 400);
  }

  // outputItemId уникален в маршруте
  const outputIds = new Set<string>();
  for (const s of sorted) {
    if (outputIds.has(s.outputItemId)) {
      throw new ServiceError(`Дублирование outputItemId: ${s.outputItemId}`, 400);
    }
    outputIds.add(s.outputItemId);
  }

  // Quantities > 0
  for (const s of sorted) {
    if (s.outputQty <= 0) throw new ServiceError(`outputQty шага ${s.stepNo} должен быть > 0`, 400);

    // Каждый шаг имеет хотя бы один input
    if (s.inputs.length === 0) {
      throw new ServiceError(`Шаг ${s.stepNo} должен иметь хотя бы один вход`, 400);
    }

    for (const inp of s.inputs) {
      if (inp.qty <= 0) throw new ServiceError(`qty входа шага ${s.stepNo} должен быть > 0`, 400);
    }

    // sortOrder уникален внутри шага
    const sortOrders = new Set<number>();
    for (const inp of s.inputs) {
      if (sortOrders.has(inp.sortOrder)) {
        throw new ServiceError(`Дублирование sortOrder ${inp.sortOrder} в шаге ${s.stepNo}`, 400);
      }
      sortOrders.add(inp.sortOrder);
    }

    // Шаг не может использовать свой output как вход
    for (const inp of s.inputs) {
      if (inp.itemId === s.outputItemId) {
        throw new ServiceError(`Шаг ${s.stepNo} использует свой выход как вход`, 400);
      }
    }

    // input.itemId не должен совпадать с outputItemId шага с stepNo >= текущего (защита от циклов)
    for (const inp of s.inputs) {
      for (const other of sorted) {
        if (other.stepNo >= s.stepNo && inp.itemId === other.outputItemId) {
          throw new ServiceError(
            `Вход шага ${s.stepNo} ссылается на выход шага ${other.stepNo} (цикл или forward reference)`,
            400,
          );
        }
      }
    }
  }
}

// --- Legacy aliases (для обратной совместимости в API routes) ---

export const getActiveRoutingByProduct = getActiveRoutingByItem;
export const getRoutingsByProduct = getRoutingsByItem;
