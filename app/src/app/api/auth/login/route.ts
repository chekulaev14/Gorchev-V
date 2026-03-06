import { NextResponse } from "next/server";
import { loginByEmail } from "@/services/auth.service";
import { createToken, buildCookieHeader } from "@/lib/auth";

export async function POST(request: Request) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Email и пароль обязательны" }, { status: 400 });
  }

  const result = await loginByEmail(email, password);
  if (!result) {
    return NextResponse.json({ error: "Неверный email или пароль" }, { status: 401 });
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
