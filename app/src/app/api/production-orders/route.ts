import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-helper";
import * as orderService from "@/services/production-order.service";
import { ProductionOrderError } from "@/services/production-order.service";
import { productionOrderActionSchema } from "@/lib/schemas/production-order.schema";
import { parseBody } from "@/lib/schemas/helpers";
import { handleRouteError } from "@/lib/api/handle-route-error";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") as "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | null;

  const orders = await orderService.getOrders(status ?? undefined);
  return NextResponse.json(orders);
}

export async function POST(request: Request) {
  try {
    const auth = getAuthContext(request);
    const body = await request.json();
    const parsed = parseBody(productionOrderActionSchema, body);
    if (!parsed.success) return parsed.response;

    switch (parsed.data.action) {
      case "CREATE": {
        const order = await orderService.createOrder({
          itemId: parsed.data.itemId,
          quantityPlanned: parsed.data.quantityPlanned,
          createdBy: auth.workerId ?? auth.actorId,
        });
        return NextResponse.json(order, { status: 201 });
      }

      case "START": {
        const order = await orderService.startOrder(parsed.data.orderId);
        return NextResponse.json(order);
      }

      case "COMPLETE": {
        const order = await orderService.completeOrder(parsed.data.orderId, auth.workerId ?? auth.actorId);
        return NextResponse.json(order);
      }

      case "CANCEL": {
        const order = await orderService.cancelOrder(parsed.data.orderId);
        return NextResponse.json(order);
      }
    }
  } catch (err) {
    if (err instanceof ProductionOrderError) {
      return NextResponse.json(
        { error: err.message, shortages: err.shortages },
        { status: 400 },
      );
    }
    return handleRouteError(err);
  }
}
