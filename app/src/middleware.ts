import { NextResponse, type NextRequest } from 'next/server';
import { verifyToken, isPublicRoute, checkAccess, getCookieName } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect /api/* routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Public routes — no auth required
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Extract token from cookie
  const token = request.cookies.get(getCookieName())?.value;
  if (!token) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  // Verify JWT
  const auth = await verifyToken(token);
  if (!auth) {
    return NextResponse.json({ error: 'Сессия истекла' }, { status: 401 });
  }

  // Check role-based access
  const access = checkAccess(pathname, request.method, auth.role);
  if (access === 'forbidden') {
    return NextResponse.json({ error: 'Нет доступа' }, { status: 403 });
  }

  // Pass auth context and requestId to route handlers via request headers
  const requestId = crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-request-id', requestId);
  requestHeaders.set('x-actor-id', auth.actorId);
  requestHeaders.set('x-actor-role', auth.role);
  if (auth.workerId) {
    requestHeaders.set('x-worker-id', auth.workerId);
  }
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: '/api/:path*',
};
