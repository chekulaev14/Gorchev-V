import { prisma } from "@/lib/prisma";
import type { AuthContext } from "@/lib/auth";
import type { WorkerRole } from "@/lib/types";
import bcrypt from "bcryptjs";

export async function loginByPin(pin: string): Promise<{ auth: AuthContext; name: string } | null> {
  if (!pin || typeof pin !== "string" || pin.length !== 4) return null;

  const worker = await prisma.worker.findUnique({
    where: { pin },
    include: { user: { include: { role: true } } },
  });
  if (!worker || !worker.active) return null;

  // If worker is linked to User, take role from User.role
  const role: WorkerRole = worker.user
    ? (worker.user.role.id.toUpperCase() as WorkerRole)
    : (worker.role as WorkerRole);

  return {
    auth: {
      actorId: worker.user?.id ?? worker.id,
      role,
      workerId: worker.id,
    },
    name: worker.name,
  };
}

export async function loginByEmail(
  email: string,
  password: string,
): Promise<{ auth: AuthContext; name: string } | null> {
  if (!email || !password) return null;

  const user = await prisma.user.findUnique({
    where: { email },
    include: { role: true, worker: true },
  });
  if (!user || !user.isActive) return null;

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;

  const role = user.role.id.toUpperCase() as WorkerRole;

  return {
    auth: {
      actorId: user.id,
      role,
      workerId: user.worker?.id ?? null,
    },
    name: user.name,
  };
}
