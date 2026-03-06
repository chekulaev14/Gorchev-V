import { NextResponse } from "next/server";

export class ServiceError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export function handleRouteError(error: unknown): NextResponse {
  console.error("[API Error]", error);

  if (error instanceof ServiceError) {
    const body: Record<string, unknown> = { error: error.message };
    if (error.details !== undefined) body.details = error.details;
    return NextResponse.json(body, { status: error.status });
  }

  if (isPrismaError(error)) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Запись уже существует" },
        { status: 409 },
      );
    }
    if (error.code === "P2025") {
      return NextResponse.json(
        { error: "Запись не найдена" },
        { status: 404 },
      );
    }
  }

  return NextResponse.json(
    { error: "Внутренняя ошибка сервера" },
    { status: 500 },
  );
}

function isPrismaError(
  error: unknown,
): error is { code: string; meta?: unknown } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  );
}
