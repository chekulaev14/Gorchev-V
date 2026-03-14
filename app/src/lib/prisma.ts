import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

function getDatabaseUrl(): string {
  if (process.env["DATABASE_URL"]) return process.env["DATABASE_URL"];
  if (process.env["ERP_DATABASE_URL"]) return process.env["ERP_DATABASE_URL"];
  return "";
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  const pool = new pg.Pool({ connectionString: getDatabaseUrl() });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
