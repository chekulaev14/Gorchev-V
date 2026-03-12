import { NextRequest, NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api/handle-route-error";
import { setupTabSchema } from "@/lib/schemas/setup-import.schema";
import * as setupService from "@/services/setup-import.service";

export async function GET(req: NextRequest) {
  try {
    const tab = req.nextUrl.searchParams.get("tab") ?? "";
    const parsed = setupTabSchema.safeParse(tab);
    if (!parsed.success) {
      return NextResponse.json(
        { error: `Недопустимый tab: ${tab}. Допустимые: nomenclature, stock, bom, routing` },
        { status: 400 },
      );
    }

    let rows: unknown[];
    switch (parsed.data) {
      case "nomenclature":
        rows = await setupService.loadNomenclature();
        break;
      case "stock":
        rows = await setupService.loadStock();
        break;
      case "bom":
        rows = await setupService.loadBom();
        break;
      case "routing":
        rows = await setupService.loadRouting();
        break;
    }

    return NextResponse.json({ rows });
  } catch (error) {
    return handleRouteError(error);
  }
}
