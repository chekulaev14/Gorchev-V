import { NextResponse } from "next/server";
import type { z } from "zod";

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
