import { NextResponse } from "next/server";
import * as routingService from "@/services/routing.service";
import { createRoutingSchema } from "@/lib/schemas/routing.schema";
import { parseBody } from "@/lib/schemas/helpers";
import { handleRouteError } from "@/lib/api/handle-route-error";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get("itemId");
    if (!itemId) {
      return NextResponse.json({ error: "itemId обязателен" }, { status: 400 });
    }
    const routings = await routingService.getRoutingsByProduct(itemId);
    return NextResponse.json(routings);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = parseBody(createRoutingSchema, body);
    if (!parsed.success) return parsed.response;

    const routing = await routingService.createRouting(parsed.data.itemId, parsed.data.steps);
    return NextResponse.json(routing, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
