import { NextResponse } from "next/server";
import * as bomVersionService from "@/services/bom-version.service";
import { createBomDraftSchema } from "@/lib/schemas/bom-version.schema";
import { parseBody } from "@/lib/schemas/helpers";
import { handleRouteError } from "@/lib/api/handle-route-error";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get("itemId");
    if (!itemId) {
      return NextResponse.json({ error: "itemId обязателен" }, { status: 400 });
    }
    const versions = await bomVersionService.getBomVersions(itemId);
    return NextResponse.json(versions);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = parseBody(createBomDraftSchema, body);
    if (!parsed.success) return parsed.response;

    const bom = await bomVersionService.createDraft({
      itemId: parsed.data.itemId,
      lines: parsed.data.lines,
    });
    return NextResponse.json(bom, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
