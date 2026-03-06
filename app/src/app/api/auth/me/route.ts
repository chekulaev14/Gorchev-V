import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helper";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const auth = getAuthContext(request);

  // Try to resolve name from User first, then Worker
  let name = "";
  const user = await prisma.user.findUnique({
    where: { id: auth.actorId },
    select: { name: true },
  });
  if (user) {
    name = user.name;
  } else if (auth.workerId) {
    const worker = await prisma.worker.findUnique({
      where: { id: auth.workerId },
      select: { name: true },
    });
    if (worker) name = worker.name;
  }

  return NextResponse.json({
    actorId: auth.actorId,
    role: auth.role,
    workerId: auth.workerId,
    name,
  });
}
