import { NextResponse } from "next/server";
import { z } from "zod";

export const idSchema = z.string().trim().min(1, "ID обязателен");

type SafeParseResult<T> =
  | { success: true; data: T }
  | { success: false; response: NextResponse };

export function parseBody<T extends z.ZodType>(
  schema: T,
  body: unknown,
): SafeParseResult<z.infer<T>> {
  const result = schema.safeParse(body);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    response: NextResponse.json(
      { error: "Ошибка валидации", details: result.error.issues },
      { status: 400 },
    ),
  };
}
