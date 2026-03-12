import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/lib/api/handle-route-error";
import { getProducingStep } from "./routing.service";
import { toNumber } from "./helpers/serialize";

const DEFAULT_LOCATION = "MAIN";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

interface WorkerAllocation {
  workerId: string;
  quantity: number;
}

interface ProduceParams {
  itemId: string;
  workers: WorkerAllocation[];
  clientOperationKey?: string;
  createdById?: string;
}

interface ProduceResult {
  productionOperationId: string;
  incomeMovementId: string;
  writeOffIds: string[];
  balance: number;
  operationKey: string;
  workers: { workerId: string; quantity: number; pricePerUnit: number; total: number }[];
}

/** Округление HALF_UP с заданной точностью */
function roundHalfUp(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor + Number.EPSILON) / factor;
}

/**
 * Производство с поддержкой нескольких рабочих.
 * Одна операция = один факт выпуска, несколько участников.
 * StockMovement создаётся один раз на общее количество.
 * Начисления — по каждому рабочему.
 */
export async function produce(params: ProduceParams): Promise<ProduceResult> {
  const { itemId, workers, clientOperationKey, createdById } = params;

  // Валидация
  if (workers.length === 0) throw new ServiceError("Нужен хотя бы один рабочий", 400);

  const totalQty = workers.reduce((sum, w) => sum + w.quantity, 0);
  if (totalQty <= 0) throw new ServiceError("Общее количество должно быть > 0", 400);

  for (const w of workers) {
    if (w.quantity <= 0) throw new ServiceError(`Количество рабочего должно быть > 0`, 400);
  }

  // Нет дублей workerId
  const workerIds = new Set(workers.map((w) => w.workerId));
  if (workerIds.size !== workers.length) {
    throw new ServiceError("Один рабочий не может быть добавлен дважды", 400);
  }

  // Найти producing step
  const step = await getProducingStep(itemId);
  if (!step) {
    throw new ServiceError("Нет маршрута для этой номенклатуры", 400);
  }

  // Собираем itemId для начальной блокировки (root + direct inputs)
  const allItemIds = collectItemIds(itemId, step.inputs);

  const opKey = clientOperationKey ?? `prod-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const result = await prisma.$transaction(async (tx) => {
    // Idempotency по clientOperationKey
    if (clientOperationKey) {
      const existingOp = await tx.productionOperation.findUnique({
        where: { clientOperationKey },
        include: {
          workers: { select: { workerId: true, quantity: true, pricePerUnit: true, total: true } },
          inventoryOperation: { include: { movements: { select: { id: true, type: true, itemId: true } } } },
        },
      });
      if (existingOp) {
        const incomeMovement = existingOp.inventoryOperation.movements.find(
          (m) => m.type === "ASSEMBLY_INCOME" && m.itemId === itemId,
        );
        const writeOffs = existingOp.inventoryOperation.movements.filter((m) => m.type === "ASSEMBLY_WRITE_OFF");
        const bal = await tx.stockBalance.findUnique({
          where: { itemId_locationId: { itemId, locationId: DEFAULT_LOCATION } },
        });
        return {
          productionOperationId: existingOp.id,
          incomeMovementId: incomeMovement?.id ?? existingOp.inventoryOperationId,
          writeOffIds: writeOffs.map((w) => w.id),
          balance: bal ? toNumber(bal.quantity) : 0,
          operationKey: existingOp.inventoryOperation.operationKey,
          workers: existingOp.workers.map((w) => ({
            workerId: w.workerId,
            quantity: toNumber(w.quantity),
            pricePerUnit: toNumber(w.pricePerUnit),
            total: toNumber(w.total),
          })),
        };
      }
    }

    // Idempotency по operationKey
    const existing = await tx.inventoryOperation.findUnique({
      where: { operationKey: opKey },
    });
    if (existing) {
      const bal = await tx.stockBalance.findUnique({
        where: { itemId_locationId: { itemId, locationId: DEFAULT_LOCATION } },
      });
      return {
        productionOperationId: "",
        incomeMovementId: existing.id,
        writeOffIds: [],
        balance: bal ? toNumber(bal.quantity) : 0,
        operationKey: opKey,
        workers: [],
      };
    }

    // Создаём InventoryOperation
    const operation = await tx.inventoryOperation.create({
      data: { operationKey: opKey, type: "ASSEMBLY", createdById },
    });

    // Ensure StockBalance rows exist
    for (const id of allItemIds) {
      await tx.$queryRaw`
        INSERT INTO stock_balances (item_id, location_id, quantity, updated_at)
        VALUES (${id}, ${DEFAULT_LOCATION}, 0, NOW())
        ON CONFLICT (item_id, location_id) DO NOTHING
      `;
    }

    // Блокировка балансов
    const lockedRows = await tx.$queryRaw<{ item_id: string; quantity: number }[]>`
      SELECT item_id, quantity FROM stock_balances
      WHERE location_id = ${DEFAULT_LOCATION} AND item_id = ANY(${allItemIds})
      ORDER BY item_id ASC
      FOR UPDATE
    `;

    const balanceMap: Record<string, number> = {};
    for (const row of lockedRows) {
      balanceMap[row.item_id] = toNumber(row.quantity);
    }

    // Рекурсивное производство
    const writeOffIds: string[] = [];
    const visited = new Set<string>();

    await produceRecursive(tx, itemId, totalQty, {
      operationId: operation.id,
      createdById,
      balanceMap,
      writeOffIds,
      visited,
    });

    // Приход готового изделия
    const income = await tx.stockMovement.create({
      data: {
        type: "ASSEMBLY_INCOME",
        itemId,
        quantity: totalQty,
        createdById,
        operationId: operation.id,
        fromLocationId: "PRODUCTION",
        toLocationId: DEFAULT_LOCATION,
        comment: `Производство ${totalQty} шт`,
      },
    });

    await tx.$queryRaw`
      UPDATE stock_balances SET quantity = quantity + ${totalQty}, updated_at = NOW()
      WHERE item_id = ${itemId} AND location_id = ${DEFAULT_LOCATION}
    `;
    balanceMap[itemId] = (balanceMap[itemId] ?? 0) + totalQty;

    // Создаём ProductionOperation
    const prodOp = await tx.productionOperation.create({
      data: {
        itemId,
        quantity: totalQty,
        routingStepId: step.id,
        inventoryOperationId: operation.id,
        createdById,
        clientOperationKey: clientOperationKey ?? null,
      },
    });

    // Получить pricePerUnit из Item
    const item = await tx.item.findUnique({
      where: { id: itemId },
      select: { pricePerUnit: true },
    });
    const pricePerUnit = item?.pricePerUnit ? toNumber(item.pricePerUnit) : 0;

    // Создаём ProductionOperationWorker для каждого рабочего
    const workerResults: ProduceResult["workers"] = [];
    for (const w of workers) {
      const total = w.quantity * pricePerUnit;
      await tx.productionOperationWorker.create({
        data: {
          productionOperationId: prodOp.id,
          workerId: w.workerId,
          quantity: w.quantity,
          pricePerUnit,
          total,
        },
      });
      workerResults.push({
        workerId: w.workerId,
        quantity: w.quantity,
        pricePerUnit,
        total,
      });
    }

    return {
      productionOperationId: prodOp.id,
      incomeMovementId: income.id,
      writeOffIds,
      balance: balanceMap[itemId],
      operationKey: opKey,
      workers: workerResults,
    };
  });

  return result;
}

// --- Internal ---

interface ProduceCtx {
  operationId: string;
  createdById?: string;
  balanceMap: Record<string, number>;
  writeOffIds: string[];
  visited: Set<string>;
}

async function produceRecursive(
  tx: Tx,
  itemId: string,
  quantity: number,
  ctx: ProduceCtx,
): Promise<void> {
  const step = await getProducingStep(itemId, tx);
  if (!step) return; // сырьё — нет producing step

  const visitKey = `${itemId}:${step.routing.id}`;
  if (ctx.visited.has(visitKey)) {
    throw new ServiceError("Обнаружен цикл между маршрутами", 400);
  }
  ctx.visited.add(visitKey);

  // Для каждого входа: рассчитать needed, достроить дефицит, списать
  for (const input of step.inputs) {
    const needed = roundHalfUp((input.qty * quantity) / step.outputQty, 4);

    // Ensure balance row
    await tx.$queryRaw`
      INSERT INTO stock_balances (item_id, location_id, quantity, updated_at)
      VALUES (${input.itemId}, ${DEFAULT_LOCATION}, 0, NOW())
      ON CONFLICT (item_id, location_id) DO NOTHING
    `;

    // Прочитать баланс (может быть ещё не в balanceMap)
    if (!(input.itemId in ctx.balanceMap)) {
      const balRow = await tx.$queryRaw<{ quantity: number }[]>`
        SELECT quantity FROM stock_balances
        WHERE item_id = ${input.itemId} AND location_id = ${DEFAULT_LOCATION}
        FOR UPDATE
      `;
      ctx.balanceMap[input.itemId] = balRow.length > 0 ? toNumber(balRow[0].quantity) : 0;
    }

    const available = ctx.balanceMap[input.itemId] ?? 0;

    if (available < needed) {
      const deficit = needed - available;
      const inputStep = await getProducingStep(input.itemId, tx);
      if (inputStep) {
        await produceRecursive(tx, input.itemId, deficit, ctx);

        // Приход промежуточного
        await tx.stockMovement.create({
          data: {
            type: "ASSEMBLY_INCOME",
            itemId: input.itemId,
            quantity: deficit,
            createdById: ctx.createdById,
            operationId: ctx.operationId,
            fromLocationId: "PRODUCTION",
            toLocationId: DEFAULT_LOCATION,
            comment: `Автосборка ${deficit} шт`,
          },
        });
        await tx.$queryRaw`
          UPDATE stock_balances SET quantity = quantity + ${deficit}, updated_at = NOW()
          WHERE item_id = ${input.itemId} AND location_id = ${DEFAULT_LOCATION}
        `;
        ctx.balanceMap[input.itemId] = (ctx.balanceMap[input.itemId] ?? 0) + deficit;
      }
    }

    // Списать вход
    const writeOff = await tx.stockMovement.create({
      data: {
        type: "ASSEMBLY_WRITE_OFF",
        itemId: input.itemId,
        quantity: needed,
        createdById: ctx.createdById,
        operationId: ctx.operationId,
        fromLocationId: DEFAULT_LOCATION,
        toLocationId: "PRODUCTION",
        comment: `Списание на производство`,
      },
    });
    await tx.$queryRaw`
      UPDATE stock_balances SET quantity = quantity - ${needed}, updated_at = NOW()
      WHERE item_id = ${input.itemId} AND location_id = ${DEFAULT_LOCATION}
    `;
    ctx.balanceMap[input.itemId] = (ctx.balanceMap[input.itemId] ?? 0) - needed;
    ctx.writeOffIds.push(writeOff.id);
  }

  ctx.visited.delete(visitKey);
}

function collectItemIds(rootItemId: string, inputs: { itemId: string }[]): string[] {
  const ids = new Set<string>();
  ids.add(rootItemId);
  for (const inp of inputs) {
    ids.add(inp.itemId);
  }
  return [...ids].sort();
}
