import { NextResponse } from "next/server";
import * as bomService from "@/services/bom.service";
import { addEntrySchema, updateEntrySchema, deleteEntrySchema } from "@/lib/schemas/bom.schema";
import { parseBody } from "@/lib/schemas/helpers";
import { handleRouteError } from "@/lib/api/handle-route-error";

export async function GET() {
  const entries = await bomService.getAllEntries();
  return NextResponse.json(entries);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = parseBody(addEntrySchema, body);
    if (!parsed.success) return parsed.response;

    const entry = await bomService.addEntry(parsed.data.parentId, parsed.data.childId, parsed.data.quantity);
    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const parsed = parseBody(updateEntrySchema, body);
    if (!parsed.success) return parsed.response;

    const entry = await bomService.updateEntry(parsed.data.parentId, parsed.data.childId, parsed.data.quantity);
    return NextResponse.json(entry);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const parsed = parseBody(deleteEntrySchema, body);
    if (!parsed.success) return parsed.response;

    await bomService.deleteEntry(parsed.data.parentId, parsed.data.childId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
