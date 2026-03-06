import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const workers = await prisma.worker.findMany({
    where: { active: true },
    select: { id: true, name: true, pin: true, role: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(workers);
}
