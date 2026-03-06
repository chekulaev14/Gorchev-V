import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") || "7");
  const workerId = searchParams.get("workerId");

  const since = new Date();
  since.setDate(since.getDate() - days);

  const where: Record<string, unknown> = {
    createdAt: { gte: since },
  };
  if (workerId) where.workerId = workerId;

  const logs = await prisma.productionLog.findMany({
    where,
    include: { worker: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  // Сводка по рабочим
  const summary: Record<string, { name: string; count: number; total: number }> = {};
  for (const log of logs) {
    if (!summary[log.workerId]) {
      summary[log.workerId] = { name: log.worker.name, count: 0, total: 0 };
    }
    summary[log.workerId].count += log.quantity;
    summary[log.workerId].total += Number(log.total);
  }

  return NextResponse.json({
    logs: logs.map((l) => ({
      id: l.id,
      workerName: l.worker.name,
      itemName: l.itemName,
      quantity: l.quantity,
      pricePerUnit: Number(l.pricePerUnit),
      total: Number(l.total),
      createdAt: l.createdAt,
    })),
    summary: Object.entries(summary).map(([id, s]) => ({
      workerId: id, ...s,
    })),
  });
}
