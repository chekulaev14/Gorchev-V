import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function getUsers() {
  return prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      roleId: true,
      role: { select: { id: true, name: true } },
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createUser(data: {
  email: string;
  password: string;
  name: string;
  roleId: string;
}) {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    throw new Error("Пользователь с таким email уже существует");
  }

  const role = await prisma.role.findUnique({ where: { id: data.roleId } });
  if (!role) {
    throw new Error("Роль не найдена");
  }

  const passwordHash = await bcrypt.hash(data.password, 10);
  return prisma.user.create({
    data: {
      email: data.email,
      passwordHash,
      name: data.name,
      roleId: data.roleId,
    },
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      roleId: true,
      role: { select: { id: true, name: true } },
      createdAt: true,
    },
  });
}

export async function updateUser(
  id: string,
  data: { name?: string; email?: string; password?: string; roleId?: string; isActive?: boolean },
) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new Error("Пользователь не найден");

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.email !== undefined) {
    const dup = await prisma.user.findUnique({ where: { email: data.email } });
    if (dup && dup.id !== id) throw new Error("Email уже занят");
    updateData.email = data.email;
  }
  if (data.password) {
    updateData.passwordHash = await bcrypt.hash(data.password, 10);
  }
  if (data.roleId !== undefined) {
    const role = await prisma.role.findUnique({ where: { id: data.roleId } });
    if (!role) throw new Error("Роль не найдена");
    updateData.roleId = data.roleId;
  }
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  return prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      roleId: true,
      role: { select: { id: true, name: true } },
      createdAt: true,
    },
  });
}

export async function deleteUser(id: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new Error("Пользователь не найден");

  // Soft delete via isActive
  return prisma.user.update({
    where: { id },
    data: { isActive: false },
  });
}

export async function getRoles() {
  return prisma.role.findMany({ orderBy: { id: "asc" } });
}
