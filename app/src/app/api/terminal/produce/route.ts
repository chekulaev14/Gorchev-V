import { NextResponse } from "next/server";
import { produce } from "@/services/production.service";
import { terminalProduceSchema } from "@/lib/schemas/terminal-produce.schema";
import { parseBody } from "@/lib/schemas/helpers";
import { getAuthContext } from "@/lib/auth-helper";
import { handleRouteError } from "@/lib/api/handle-route-error";

export async function POST(request: Request) {
  try {
    const auth = getAuthContext(request);
    const body = await request.json();
    const parsed = parseBody(terminalProduceSchema, body);
    if (!parsed.success) return parsed.response;

    const { itemId, workers, clientOperationKey } = parsed.data;

    const result = await produce({
      itemId,
      workers,
      clientOperationKey,
      createdById: auth.actorId || undefined,
    });

    return NextResponse.json({
      ok: true,
      productionOperationId: result.productionOperationId,
      balance: result.balance,
      workers: result.workers,
    }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
