import { NextResponse } from "next/server";
import { recordOutput, AssemblyError } from "@/services/terminal-output.service";
import { getAuthContext } from "@/lib/auth-helper";
import { handleRouteError } from "@/lib/api/handle-route-error";

export async function POST(request: Request) {
  try {
    const auth = getAuthContext(request);
    const { itemId, itemName, quantity, pricePerUnit } = await request.json();

    if (!itemId || !itemName || !quantity) {
      return NextResponse.json({ error: "Все поля обязательны" }, { status: 400 });
    }

    const workerId = auth.workerId ?? auth.actorId;

    const result = await recordOutput({
      itemId,
      itemName,
      quantity,
      pricePerUnit: pricePerUnit ?? 0,
      workerId,
    });
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (err) {
    if (err instanceof AssemblyError) {
      return NextResponse.json(
        { error: err.message },
        { status: 400 },
      );
    }
    return handleRouteError(err);
  }
}
