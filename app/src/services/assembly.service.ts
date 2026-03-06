import { prisma } from "@/lib/prisma";
import { getBalance } from "./stock.service";
import { toNumber } from "./helpers/serialize";

interface Shortage {
  name: string;
  needed: number;
  available: number;
}

interface AssemblyResult {
  movement: { id: string };
  writeOffs: { id: string }[];
  balance: number;
}

export class AssemblyError extends Error {
  constructor(
    message: string,
    public shortages?: Shortage[],
  ) {
    super(message);
    this.name = "AssemblyError";
  }
}

export async function assemble(params: {
  itemId: string;
  quantity: number;
  workerId?: string;
  comment?: string;
}): Promise<AssemblyResult> {
  const { itemId, quantity, workerId, comment } = params;

  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item) throw new AssemblyError("Позиция не найдена");

  const children = await prisma.bomEntry.findMany({
    where: { parentId: itemId },
    include: { child: true },
  });

  if (children.length === 0) {
    throw new AssemblyError("У позиции нет спецификации (BOM)");
  }

  const shortages: Shortage[] = [];
  for (const child of children) {
    const needed = toNumber(child.quantity) * quantity;
    const available = await getBalance(child.childId);
    if (available < needed) {
      shortages.push({
        name: child.child.name,
        needed: Math.round(needed * 1000) / 1000,
        available: Math.round(available * 1000) / 1000,
      });
    }
  }

  if (shortages.length > 0) {
    throw new AssemblyError("Недостаточно компонентов", shortages);
  }

  const result = await prisma.$transaction(async (tx) => {
    const writeOffs = [];
    for (const child of children) {
      const needed = toNumber(child.quantity) * quantity;
      const mov = await tx.stockMovement.create({
        data: {
          type: "ASSEMBLY_WRITE_OFF",
          itemId: child.childId,
          quantity: needed,
          workerId,
          comment: `Списание на сборку ${item.name} x${quantity}`,
        },
      });
      writeOffs.push(mov);
    }

    const movement = await tx.stockMovement.create({
      data: {
        type: "ASSEMBLY_INCOME",
        itemId,
        quantity,
        workerId,
        comment: comment || `Сборка ${quantity} шт`,
      },
    });

    return { movement, writeOffs };
  });

  const balance = await getBalance(itemId);
  return { ...result, balance };
}
