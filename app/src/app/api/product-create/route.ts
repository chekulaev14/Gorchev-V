import { NextResponse } from "next/server";
import * as productService from "@/services/product.service";
import { createProductSchema } from "@/lib/schemas/product.schema";
import { parseBody } from "@/lib/schemas/helpers";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Неверный формат данных" }, { status: 400 });
  }

  const parsed = parseBody(createProductSchema, body);
  if (!parsed.success) return parsed.response;

  const { product, components, isPaired } = parsed.data;

  try {
    const result = isPaired
      ? await productService.createPairedProducts(product, components)
      : await productService.createSingleProduct(product, components);

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ошибка при создании";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
