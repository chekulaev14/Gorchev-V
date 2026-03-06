import { NextResponse } from "next/server";
import * as productService from "@/services/product.service";
import { createProductSchema } from "@/lib/schemas/product.schema";
import { parseBody } from "@/lib/schemas/helpers";
import { handleRouteError } from "@/lib/api/handle-route-error";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = parseBody(createProductSchema, body);
    if (!parsed.success) return parsed.response;

    const { product, components, isPaired } = parsed.data;

    const result = isPaired
      ? await productService.createPairedProducts(product, components)
      : await productService.createSingleProduct(product, components);

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
