import { NextResponse } from "next/server";
import { buildLogoutCookieHeader } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.headers.set("Set-Cookie", buildLogoutCookieHeader());
  return response;
}
