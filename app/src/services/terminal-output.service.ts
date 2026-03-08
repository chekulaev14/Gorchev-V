import { prisma } from "@/lib/prisma";
import { assemble, AssemblyError } from "./assembly.service";

interface OutputParams {
  itemId: string;
  itemName: string;
  quantity: number;
  pricePerUnit?: number;
  workerId: string;
}

interface OutputResult {
  id: string;
  total: number;
}

export { AssemblyError };

export async function recordOutput(params: OutputParams): Promise<OutputResult> {
  const { itemId, itemName, quantity, pricePerUnit = 0, workerId } = params;
  const qty = Math.round(quantity);
  const total = qty * pricePerUnit;

  const children = await prisma.bomEntry.findMany({ where: { parentId: itemId } });
  if (children.length > 0) {
    await assemble({ itemId, quantity: qty, workerId });
  }

  const log = await prisma.productionLog.create({
    data: { workerId, itemId, itemName, quantity: qty, pricePerUnit, total },
  });

  return { id: log.id, total };
}
