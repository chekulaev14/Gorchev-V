import { NextResponse } from 'next/server';
import { getCatalog } from '@/services/catalog.service';
import { withRequestId, log } from '@/lib/logger';

export const GET = withRequestId(async (_req) => {
  log.info('GET /api/terminal/catalog: start');
  const catalog = await getCatalog();
  log.info('GET /api/terminal/catalog: done');
  return NextResponse.json(catalog);
});
