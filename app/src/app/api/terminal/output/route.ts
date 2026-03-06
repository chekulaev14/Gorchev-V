import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const { workerId, itemId, itemName, quantity, pricePerUnit } = await request.json();

  if (!workerId || !itemId || !itemName || !quantity || !pricePerUnit) {
    return NextResponse.json({ error: "Все поля обязательны" }, { status: 400 });
  }

  const total = quantity * pricePerUnit;

  const log = await prisma.productionLog.create({
    data: {
      workerId,
      itemId,
      itemName,
      quantity: Math.round(quantity),
      pricePerUnit,
      total,
    },
  });

  return NextResponse.json({ ok: true, id: log.id, total }, { status: 201 });
}
