import { NextResponse } from "next/server";
import * as stockService from "@/services/stock.service";
import { assemble, AssemblyError } from "@/services/assembly.service";
import { getAuthContext } from "@/lib/auth-helper";
import { createMovementSchema } from "@/lib/schemas/stock.schema";
import { parseBody } from "@/lib/schemas/helpers";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get("itemId");

  if (itemId) {
    const [balance, movements] = await Promise.all([
      stockService.getBalance(itemId),
      stockService.getMovements(itemId, 50),
    ]);
    return NextResponse.json({ balance, movements });
  }

  const [balances, movements] = await Promise.all([
    stockService.getAllBalances(),
    stockService.getMovements(undefined, 100),
  ]);

  return NextResponse.json({ balances, movements });
}

export async function POST(request: Request) {
  const auth = getAuthContext(request);
  const body = await request.json();
  const parsed = parseBody(createMovementSchema, body);
  if (!parsed.success) return parsed.response;

  const { action, itemId, quantity, comment } = parsed.data;
  const workerId = auth.workerId ?? auth.actorId;

  const item = await stockService.validateItemExists(itemId);
  if (!item) {
    return NextResponse.json({ error: "Позиция не найдена" }, { status: 404 });
  }

  switch (action) {
    case "SUPPLIER_INCOME":
    case "PRODUCTION_INCOME": {
      const mov = await stockService.createMovement({
        type: action,
        itemId,
        quantity,
        workerId,
        comment,
      });
      return NextResponse.json({ movement: mov, balance: await stockService.getBalance(itemId) });
    }

    case "ASSEMBLY": {
      try {
        const result = await assemble({ itemId, quantity, workerId, comment });
        return NextResponse.json(result);
      } catch (err) {
        if (err instanceof AssemblyError) {
          return NextResponse.json(
            { error: err.message, shortages: err.shortages },
            { status: 400 },
          );
        }
        throw err;
      }
    }
  }
}
