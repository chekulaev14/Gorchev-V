import { NextResponse } from "next/server";
import * as nomenclatureService from "@/services/nomenclature.service";
import * as bomService from "@/services/bom.service";
import { createItemSchema } from "@/lib/schemas/nomenclature.schema";
import { parseBody } from "@/lib/schemas/helpers";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get("itemId");

  if (itemId) {
    const [children, parents] = await Promise.all([
      bomService.getChildren(itemId),
      bomService.getParents(itemId),
    ]);
    return NextResponse.json({ children, parents });
  }

  const result = await nomenclatureService.getItems({
    type: searchParams.get("type") || undefined,
    category: searchParams.get("category") || undefined,
    search: searchParams.get("search") || undefined,
    deleted: searchParams.get("deleted") === "1",
  });

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = parseBody(createItemSchema, body);
  if (!parsed.success) return parsed.response;

  const item = await nomenclatureService.createItem({
    name: parsed.data.name,
    typeId: parsed.data.typeId,
    unitId: parsed.data.unitId,
    categoryId: parsed.data.categoryId ?? null,
    description: parsed.data.description ?? null,
    pricePerUnit: parsed.data.pricePerUnit ?? null,
  });

  return NextResponse.json(item, { status: 201 });
}
