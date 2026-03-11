import { prisma } from "@/lib/prisma";
import { toNumber } from "./helpers/serialize";

const DEFAULT_LOCATION = "MAIN";

interface AssemblyResult {
  movement: { id: string };
  writeOffs: { id: string }[];
  balance: number;
}

export class AssemblyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssemblyError";
  }
}

type BomChild = {
  childId: string;
  quantity: { toNumber(): number };
  child: { id: string; name: string };
};

type BomCache = Map<string, BomChild[]>;

// Рекурсивный сбор всех itemId и BOM-записей
async function collectBomTree(rootId: string): Promise<{ allIds: string[]; bomCache: BomCache }> {
  const bomCache: BomCache = new Map();
  const allIds = new Set<string>();

  async function walk(id: string) {
    if (bomCache.has(id)) return;
    allIds.add(id);
    const children = await prisma.bomEntry.findMany({
      where: { parentId: id },
      include: { child: { select: { id: true, name: true } } },
    });
    bomCache.set(id, children);
    for (const c of children) {
      allIds.add(c.childId);
      await walk(c.childId);
    }
  }

  await walk(rootId);
  return { allIds: [...allIds].sort(), bomCache };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

interface AssembleCtx {
  operationId: string;
  workerId?: string;
  createdById?: string;
  bomCache: BomCache;
  balanceMap: Record<string, number>;
  visited: Set<string>;
}

// Рекурсивная сборка одного узла: сначала собирает детей (если у них есть BOM), потом списывает и зачисляет
async function assembleNode(
  tx: Tx,
  itemId: string,
  quantity: number,
  ctx: AssembleCtx,
): Promise<{ incomeId: string; writeOffIds: string[] }> {
  const children = ctx.bomCache.get(itemId);
  if (!children || children.length === 0) {
    throw new AssemblyError("У позиции нет спецификации (BOM)");
  }

  if (ctx.visited.has(itemId)) {
    throw new AssemblyError("Обнаружен цикл в BOM");
  }
  ctx.visited.add(itemId);

  const allWriteOffIds: string[] = [];

  // Рекурсия: для каждого компонента, у которого есть свой BOM — собрать его
  for (const child of children) {
    const needed = toNumber(child.quantity) * quantity;
    const childBom = ctx.bomCache.get(child.childId);
    if (childBom && childBom.length > 0) {
      const sub = await assembleNode(tx, child.childId, needed, ctx);
      allWriteOffIds.push(...sub.writeOffIds, sub.incomeId);
    }
  }

  // Получаем имя для комментариев
  const item = await tx.item.findUnique({ where: { id: itemId }, select: { name: true } });
  const itemName = item?.name ?? itemId;

  // Списание компонентов
  for (const child of children) {
    const needed = toNumber(child.quantity) * quantity;
    const mov = await tx.stockMovement.create({
      data: {
        type: "ASSEMBLY_WRITE_OFF",
        itemId: child.childId,
        quantity: needed,
        workerId: ctx.workerId,
        createdById: ctx.createdById,
        operationId: ctx.operationId,
        fromLocationId: DEFAULT_LOCATION,
        toLocationId: null,
        comment: `Списание на сборку ${itemName} x${quantity}`,
      },
    });
    await tx.$queryRaw`
      UPDATE stock_balances SET quantity = quantity - ${needed}, updated_at = NOW()
      WHERE item_id = ${child.childId} AND location_id = ${DEFAULT_LOCATION}
    `;
    ctx.balanceMap[child.childId] = (ctx.balanceMap[child.childId] ?? 0) - needed;
    allWriteOffIds.push(mov.id);
  }

  // Приход собранной позиции
  const income = await tx.stockMovement.create({
    data: {
      type: "ASSEMBLY_INCOME",
      itemId,
      quantity,
      workerId: ctx.workerId,
      createdById: ctx.createdById,
      operationId: ctx.operationId,
      fromLocationId: null,
      toLocationId: DEFAULT_LOCATION,
      comment: `Сборка ${quantity} шт`,
    },
  });
  await tx.$queryRaw`
    UPDATE stock_balances SET quantity = quantity + ${quantity}, updated_at = NOW()
    WHERE item_id = ${itemId} AND location_id = ${DEFAULT_LOCATION}
  `;
  ctx.balanceMap[itemId] = (ctx.balanceMap[itemId] ?? 0) + quantity;

  ctx.visited.delete(itemId);

  return { incomeId: income.id, writeOffIds: allWriteOffIds };
}

export async function assemble(params: {
  itemId: string;
  quantity: number;
  workerId?: string;
  createdById?: string;
  comment?: string;
  operationKey?: string;
}): Promise<AssemblyResult> {
  const { itemId, quantity, workerId, createdById, comment, operationKey } = params;

  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item) throw new AssemblyError("Позиция не найдена");

  // Собираем всё дерево BOM и все itemId для блокировки
  const { allIds, bomCache } = await collectBomTree(itemId);

  const topChildren = bomCache.get(itemId);
  if (!topChildren || topChildren.length === 0) {
    throw new AssemblyError("У позиции нет спецификации (BOM)");
  }

  const result = await prisma.$transaction(async (tx) => {
    // Idempotency
    const opKey = operationKey ?? `asm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const existing = await tx.inventoryOperation.findUnique({
      where: { operationKey: opKey },
      include: { movements: { select: { id: true, type: true, itemId: true } } },
    });
    if (existing) {
      const incomeMovement = existing.movements.find(
        (m) => m.type === "ASSEMBLY_INCOME" && m.itemId === itemId,
      );
      const writeOffs = existing.movements.filter((m) => m.type === "ASSEMBLY_WRITE_OFF");
      const bal = await tx.stockBalance.findUnique({
        where: { itemId_locationId: { itemId, locationId: DEFAULT_LOCATION } },
      });
      return {
        movement: { id: incomeMovement?.id ?? existing.id },
        writeOffs: writeOffs.map((w) => ({ id: w.id })),
        balance: bal ? toNumber(bal.quantity) : 0,
      };
    }

    // Одна InventoryOperation на всю рекурсивную цепочку
    const operation = await tx.inventoryOperation.create({
      data: { operationKey: opKey, type: "ASSEMBLY", createdById },
    });

    // Ensure StockBalance rows exist для всех позиций в дереве
    for (const id of allIds) {
      await tx.$queryRaw`
        INSERT INTO stock_balances (item_id, location_id, quantity, updated_at)
        VALUES (${id}, ${DEFAULT_LOCATION}, 0, NOW())
        ON CONFLICT (item_id, location_id) DO NOTHING
      `;
    }

    // Блокировка всех балансов разом (FOR UPDATE, ORDER BY ASC)
    const lockedRows = await tx.$queryRaw<{ item_id: string; quantity: number }[]>`
      SELECT item_id, quantity FROM stock_balances
      WHERE location_id = ${DEFAULT_LOCATION} AND item_id = ANY(${allIds})
      ORDER BY item_id ASC
      FOR UPDATE
    `;

    const balanceMap: Record<string, number> = {};
    for (const row of lockedRows) {
      balanceMap[row.item_id] = toNumber(row.quantity);
    }

    // Рекурсивная сборка
    const ctx: AssembleCtx = {
      operationId: operation.id,
      workerId,
      createdById,
      bomCache,
      balanceMap,
      visited: new Set(),
    };

    const { incomeId, writeOffIds } = await assembleNode(tx, itemId, quantity, ctx);

    // Обновляем комментарий корневого прихода если передан
    if (comment) {
      await tx.stockMovement.update({
        where: { id: incomeId },
        data: { comment },
      });
    }

    return {
      movement: { id: incomeId },
      writeOffs: writeOffIds.map((id) => ({ id })),
      balance: ctx.balanceMap[itemId] ?? 0,
    };
  });

  return result;
}
