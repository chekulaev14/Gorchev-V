import { prisma } from "@/lib/prisma";
import { produce } from "./production.service";
import { getProducingStep } from "./routing.service";

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

/**
 * @deprecated Используй POST /api/terminal/produce + production.service.produce()
 * Оставлен для обратной совместимости старого endpoint /api/terminal/output
 */
export async function recordOutput(params: OutputParams): Promise<OutputResult> {
  const { itemId, itemName, quantity, pricePerUnit = 0, workerId } = params;
  const qty = Math.round(quantity);
  const total = qty * pricePerUnit;

  const step = await getProducingStep(itemId);
  if (step) {
    await produce({
      itemId,
      workers: [{ workerId, quantity: qty }],
    });
  }

  const log = await prisma.productionLog.create({
    data: { workerId, itemId, itemName, quantity: qty, pricePerUnit, total },
  });

  return { id: log.id, total };
}
