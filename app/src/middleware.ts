import { NextResponse, type NextRequest } from "next/server";
import { verifyToken, isPublicRoute, checkAccess, getCookieName } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect /api/* routes
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Public routes — no auth required
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Extract token from cookie
  const token = request.cookies.get(getCookieName())?.value;
  if (!token) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  // Verify JWT
  const auth = await verifyToken(token);
  if (!auth) {
    return NextResponse.json({ error: "Сессия истекла" }, { status: 401 });
  }

  // Check role-based access
  const access = checkAccess(pathname, request.method, auth.role);
  if (access === "forbidden") {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  // Pass auth context to route handlers via headers
  const response = NextResponse.next();
  response.headers.set("x-actor-id", auth.actorId);
  response.headers.set("x-actor-role", auth.role);
  if (auth.workerId) {
    response.headers.set("x-worker-id", auth.workerId);
  }

  return response;
}

export const config = {
  matcher: "/api/:path*",
};
