import { NextResponse } from "next/server";
import { loginByPin } from "@/services/auth.service";
import { createToken, buildCookieHeader } from "@/lib/auth";

export async function POST(request: Request) {
  const { pin } = await request.json();

  const result = await loginByPin(pin);
  if (!result) {
    return NextResponse.json({ error: "Неверный PIN-код" }, { status: 401 });
  }

  const token = await createToken(result.auth);
  const response = NextResponse.json({
    id: result.auth.actorId,
    name: result.name,
    role: result.auth.role,
  });

  response.headers.set("Set-Cookie", buildCookieHeader(token, result.auth.role));
  return response;
}
