import { NextResponse } from "next/server";
import * as bomService from "@/services/bom.service";
import { addEntrySchema, updateEntrySchema, deleteEntrySchema } from "@/lib/schemas/bom.schema";
import { parseBody } from "@/lib/schemas/helpers";

export async function GET() {
  const entries = await bomService.getAllEntries();
  return NextResponse.json(entries);
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = parseBody(addEntrySchema, body);
  if (!parsed.success) return parsed.response;

  try {
    const entry = await bomService.addEntry(parsed.data.parentId, parsed.data.childId, parsed.data.quantity);
    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ошибка";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  const body = await request.json();
  const parsed = parseBody(updateEntrySchema, body);
  if (!parsed.success) return parsed.response;

  const entry = await bomService.updateEntry(parsed.data.parentId, parsed.data.childId, parsed.data.quantity);
  return NextResponse.json(entry);
}

export async function DELETE(request: Request) {
  const body = await request.json();
  const parsed = parseBody(deleteEntrySchema, body);
  if (!parsed.success) return parsed.response;

  await bomService.deleteEntry(parsed.data.parentId, parsed.data.childId);
  return NextResponse.json({ ok: true });
}
