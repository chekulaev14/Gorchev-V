import { describe, it, expect } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { withRequestId, getRequestId } from '../logger';

describe('withRequestId', () => {
  it('читает requestId из header и устанавливает в ALS', async () => {
    let capturedId: string | undefined;

    const handler = withRequestId(async () => {
      capturedId = getRequestId();
      return NextResponse.json({ ok: true });
    });

    const req = new NextRequest('http://localhost/api/test', {
      headers: { 'x-request-id': 'req-abc-123' },
    });

    await handler(req);
    expect(capturedId).toBe('req-abc-123');
  });

  it('генерирует requestId если header отсутствует', async () => {
    let capturedId: string | undefined;

    const handler = withRequestId(async () => {
      capturedId = getRequestId();
      return NextResponse.json({ ok: true });
    });

    const req = new NextRequest('http://localhost/api/test');
    await handler(req);
    expect(capturedId).toMatch(/^[0-9a-f-]{36}$/);
  });
});
