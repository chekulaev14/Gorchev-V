import type { PrismaClient } from "@/generated/prisma/client";

export type CodeKind = "MATERIAL" | "BLANK" | "PRODUCT";

const PREFIX_MAP: Record<CodeKind, string> = {
  MATERIAL: "MAT",
  BLANK: "BLK",
  PRODUCT: "PRD",
};

const TYPE_TO_KIND: Record<string, CodeKind> = {
  material: "MATERIAL",
  blank: "BLANK",
  product: "PRODUCT",
};

export function toCodeKind(typeId: string): CodeKind {
  const kind = TYPE_TO_KIND[typeId];
  if (!kind) throw new Error(`Unknown typeId: ${typeId}`);
  return kind;
}

type TxClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

export async function getNextCode(tx: TxClient, kind: CodeKind): Promise<string> {
  const result = await tx.$queryRawUnsafe<{ value: number }[]>(
    `UPDATE code_counters SET value = value + 1 WHERE key = $1 RETURNING value`,
    kind,
  );

  if (!result.length) {
    throw new Error(`CodeCounter row not found for key "${kind}". Run migration.`);
  }

  const prefix = PREFIX_MAP[kind];
  const num = String(result[0].value).padStart(3, "0");
  return `${prefix}-${num}`;
}
