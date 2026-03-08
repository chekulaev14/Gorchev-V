import { NextResponse } from "next/server";
import { getCatalog } from "@/services/catalog.service";

export async function GET() {
  const catalog = await getCatalog();
  return NextResponse.json(catalog);
}
