import { NextResponse } from "next/server";
import * as bomVersionService from "@/services/bom-version.service";
import { handleRouteError } from "@/lib/api/handle-route-error";

export async function PUT(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const bom = await bomVersionService.activateVersion(id);
    return NextResponse.json(bom);
  } catch (err) {
    return handleRouteError(err);
  }
}
