import { NextRequest, NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api/handle-route-error";
import { setupPayloadSchema, MAX_ROWS } from "@/lib/schemas/setup-import.schema";
import * as setupService from "@/services/setup-import.service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Check maxRows before zod parsing
    if (Array.isArray(body?.rows) && body.rows.length > MAX_ROWS) {
      return NextResponse.json(
        { error: `Превышен лимит строк: ${body.rows.length} > ${MAX_ROWS}` },
        { status: 400 },
      );
    }

    const parsed = setupPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Ошибка валидации payload", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const { tab, rows } = parsed.data;

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Массив строк пуст" },
        { status: 400 },
      );
    }

    let result;
    switch (tab) {
      case "nomenclature":
        result = await setupService.validateNomenclature(rows as Record<string, unknown>[]);
        break;
      case "stock":
        result = await setupService.validateStock(rows as Record<string, unknown>[]);
        break;
      case "bom":
        result = await setupService.validateBom(rows as Record<string, unknown>[]);
        break;
      case "routing":
        result = await setupService.validateRouting(rows as Record<string, unknown>[]);
        break;
    }

    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
