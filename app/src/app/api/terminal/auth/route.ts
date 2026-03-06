import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const { pin } = await request.json();

  if (!pin || typeof pin !== "string" || pin.length !== 4) {
    return NextResponse.json({ error: "PIN должен быть 4 цифры" }, { status: 400 });
  }

  const worker = await prisma.worker.findUnique({
    where: { pin },
  });

  if (!worker || !worker.active) {
    return NextResponse.json({ error: "Неверный PIN-код" }, { status: 401 });
  }

  return NextResponse.json({ id: worker.id, name: worker.name, role: worker.role });
}
