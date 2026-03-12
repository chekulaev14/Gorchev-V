import { NextResponse } from "next/server";
import * as routingService from "@/services/routing.service";
import { updateRoutingStepsSchema } from "@/lib/schemas/routing.schema";
import { parseBody } from "@/lib/schemas/helpers";
import { handleRouteError } from "@/lib/api/handle-route-error";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = parseBody(updateRoutingStepsSchema, body);
    if (!parsed.success) return parsed.response;

    const routing = await routingService.updateRoutingSteps(id, parsed.data.steps);
    return NextResponse.json(routing);
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
    await routingService.deleteRouting(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
