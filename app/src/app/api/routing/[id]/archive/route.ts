import { NextResponse } from "next/server";
import * as routingService from "@/services/routing.service";
import { handleRouteError } from "@/lib/api/handle-route-error";

export async function PUT(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const routing = await routingService.archiveRouting(id);
    return NextResponse.json(routing);
  } catch (err) {
    return handleRouteError(err);
  }
}
