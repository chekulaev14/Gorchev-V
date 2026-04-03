import pino from 'pino';
import { AsyncLocalStorage } from 'async_hooks';

const als = new AsyncLocalStorage<string>();

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  ...(process.env.NODE_ENV === 'development' && {
    transport: { target: 'pino-pretty', options: { colorize: true } },
  }),
});

export function getLogger() {
  return logger;
}

export function runWithRequestId<T>(requestId: string, fn: () => Promise<T>): Promise<T> {
  return als.run(requestId, fn);
}

export function getRequestId(): string | undefined {
  return als.getStore();
}

export const log = {
  info: (msg: string, data?: Record<string, unknown>) =>
    logger.info({ requestId: getRequestId(), ...data }, msg),
  warn: (msg: string, data?: Record<string, unknown>) =>
    logger.warn({ requestId: getRequestId(), ...data }, msg),
  error: (msg: string, data?: Record<string, unknown>) =>
    logger.error({ requestId: getRequestId(), ...data }, msg),
};

import type { NextRequest } from 'next/server';

type RouteHandler = (req: NextRequest, ctx?: unknown) => Promise<Response>;

export function withRequestId(handler: RouteHandler): RouteHandler {
  return async (req, ctx) => {
    const requestId = req.headers.get('x-request-id') ?? crypto.randomUUID();
    return runWithRequestId(requestId, () => handler(req, ctx));
  };
}
