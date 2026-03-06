import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assemble, AssemblyError } from "@/services/assembly.service";
import { getAuthContext } from "@/lib/auth-helper";

export async function POST(request: Request) {
  const auth = getAuthContext(request);
  const { itemId, itemName, quantity, pricePerUnit } = await request.json();

  if (!itemId || !itemName || !quantity) {
    return NextResponse.json({ error: "Все поля обязательны" }, { status: 400 });
  }

  const workerId = auth.workerId ?? auth.actorId;
  const price = pricePerUnit ?? 0;
  const total = quantity * price;
  const qty = Math.round(quantity);

  const item = await prisma.item.findUnique({ where: { id: itemId }, select: { typeId: true } });

  if (item?.typeId === "product") {
    const children = await prisma.bomEntry.findMany({ where: { parentId: itemId } });

    if (children.length > 0) {
      try {
        await assemble({ itemId, quantity: qty, workerId });
      } catch (err) {
        if (err instanceof AssemblyError) {
          return NextResponse.json(
            { error: err.message, shortages: err.shortages },
            { status: 400 },
          );
        }
        throw err;
      }
    }
  }

  const log = await prisma.productionLog.create({
    data: { workerId, itemId, itemName, quantity: qty, pricePerUnit: price, total },
  });

  return NextResponse.json({ ok: true, id: log.id, total }, { status: 201 });
}
