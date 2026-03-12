import { prisma } from "@/lib/prisma";
import { toNumber } from "./helpers/serialize";

interface LogEntry {
  id: string;
  workerName: string;
  itemName: string;
  quantity: number;
  pricePerUnit: number;
  total: number;
  createdAt: Date;
}

interface WorkerSummary {
  workerId: string;
  name: string;
  count: number;
  total: number;
}

export async function getProductionLogs(params: {
  days: number;
  workerId?: string;
}): Promise<{ logs: LogEntry[]; summary: WorkerSummary[] }> {
  const since = new Date();
  since.setDate(since.getDate() - params.days);

  // Новая модель: ProductionOperationWorker
  const newWhere: Record<string, unknown> = {
    createdAt: { gte: since },
  };
  if (params.workerId) newWhere.workerId = params.workerId;

  const newLogs = await prisma.productionOperationWorker.findMany({
    where: newWhere,
    include: {
      worker: { select: { name: true } },
      productionOperation: {
        include: { item: { select: { name: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Legacy: ProductionLog (для данных до миграции)
  const legacyWhere: Record<string, unknown> = {
    createdAt: { gte: since },
  };
  if (params.workerId) legacyWhere.workerId = params.workerId;

  const legacyLogs = await prisma.productionLog.findMany({
    where: legacyWhere,
    include: { worker: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  // Объединяем и сортируем
  const allLogs: LogEntry[] = [];

  // Новые записи
  for (const l of newLogs) {
    allLogs.push({
      id: l.id,
      workerName: l.worker.name,
      itemName: l.productionOperation.item.name,
      quantity: toNumber(l.quantity),
      pricePerUnit: toNumber(l.pricePerUnit),
      total: toNumber(l.total),
      createdAt: l.createdAt,
    });
  }

  // Legacy записи (исключаем дубли по времени — если новая запись создана в тот же момент)
  const newLogTimes = new Set(newLogs.map((l) => l.createdAt.getTime()));
  for (const l of legacyLogs) {
    // Простая дедупликация: если нет новой записи в ту же секунду для того же worker
    if (!newLogTimes.has(l.createdAt.getTime())) {
      allLogs.push({
        id: l.id,
        workerName: l.worker.name,
        itemName: l.itemName,
        quantity: l.quantity,
        pricePerUnit: Number(l.pricePerUnit),
        total: Number(l.total),
        createdAt: l.createdAt,
      });
    }
  }

  // Сортировка по дате desc
  allLogs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  // Summary
  const summaryMap: Record<string, { name: string; count: number; total: number }> = {};
  for (const log of allLogs) {
    const key = log.workerName;
    if (!summaryMap[key]) {
      summaryMap[key] = { name: log.workerName, count: 0, total: 0 };
    }
    summaryMap[key].count += log.quantity;
    summaryMap[key].total += log.total;
  }

  return {
    logs: allLogs,
    summary: Object.entries(summaryMap).map(([, s]) => ({
      workerId: "",
      ...s,
    })),
  };
}
