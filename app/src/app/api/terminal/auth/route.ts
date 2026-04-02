import { NextResponse } from 'next/server';
import { loginByPin } from '@/services/auth.service';
import { createToken, buildCookieHeader } from '@/lib/auth';
import { handleRouteError } from '@/lib/api/handle-route-error';
import { withRequestId, log } from '@/lib/logger';

export const POST = withRequestId(async (req) => {
  log.info('POST /api/terminal/auth: start');
  try {
    const { pin, verifyOnly } = await req.json();

    const result = await loginByPin(pin);
    if (!result) {
      return NextResponse.json({ error: 'Неверный PIN-код' }, { status: 401 });
    }

    const response = NextResponse.json({
      id: result.auth.actorId,
      name: result.name,
      role: result.auth.role,
    });

    if (!verifyOnly) {
      const token = await createToken(result.auth);
      response.headers.set('Set-Cookie', buildCookieHeader(token, result.auth.role));
    }

    log.info('POST /api/terminal/auth: done');
    return response;
  } catch (err) {
    return handleRouteError(err);
  }
});
