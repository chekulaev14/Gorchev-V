import { NextResponse } from "next/server";
import * as bomVersionService from "@/services/bom-version.service";
import { updateBomDraftSchema } from "@/lib/schemas/bom-version.schema";
import { parseBody } from "@/lib/schemas/helpers";
import { handleRouteError } from "@/lib/api/handle-route-error";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = parseBody(updateBomDraftSchema, body);
    if (!parsed.success) return parsed.response;

    const bom = await bomVersionService.updateDraft(id, parsed.data.lines);
    return NextResponse.json(bom);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await bomVersionService.deleteDraft(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
