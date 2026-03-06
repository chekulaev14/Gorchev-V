import { NextResponse } from "next/server";
import * as processService from "@/services/process.service";
import { createProcessPostSchema, updateProcessSchema } from "@/lib/schemas/process.schema";
import { parseBody } from "@/lib/schemas/helpers";
import { z } from "zod";

export async function GET() {
  const groups = await processService.getGroups();
  return NextResponse.json({ groups });
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = parseBody(createProcessPostSchema, { type: "process", ...body });
  if (!parsed.success) return parsed.response;

  if (parsed.data.type === "group") {
    const created = await processService.createGroup({
      id: parsed.data.id,
      name: parsed.data.name,
      order: parsed.data.order,
    });
    return NextResponse.json(created, { status: 201 });
  }

  const created = await processService.createProcess({
    name: parsed.data.name,
    groupId: parsed.data.groupId,
  });
  return NextResponse.json(created, { status: 201 });
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const parsed = parseBody(updateProcessSchema, body);
  if (!parsed.success) return parsed.response;

  if (parsed.data.type === "process") {
    const updated = await processService.updateProcess(parsed.data.id, parsed.data.name);
    return NextResponse.json(updated);
  }

  const updated = await processService.updateGroup(parsed.data.id, parsed.data.name);
  return NextResponse.json(updated);
}

const deleteParamsSchema = z.object({
  id: z.string().min(1, "id обязателен"),
  type: z.enum(["process", "group"]).default("process"),
});

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = deleteParamsSchema.safeParse({
    id: searchParams.get("id"),
    type: searchParams.get("type") || undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ошибка валидации", details: parsed.error.issues },
      { status: 400 },
    );
  }

  if (parsed.data.type === "group") {
    await processService.deleteGroup(parsed.data.id);
  } else {
    await processService.deleteProcess(parsed.data.id);
  }

  return NextResponse.json({ ok: true });
}
