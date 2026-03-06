import { NextResponse } from "next/server";
import * as nomenclatureService from "@/services/nomenclature.service";
import { updateItemSchema } from "@/lib/schemas/nomenclature.schema";
import { parseBody } from "@/lib/schemas/helpers";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const parsed = parseBody(updateItemSchema, body);
  if (!parsed.success) return parsed.response;

  const updated = await nomenclatureService.updateItem(id, parsed.data);
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await nomenclatureService.softDelete(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ошибка удаления";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await nomenclatureService.restore(id);
  return NextResponse.json({ ok: true });
}
