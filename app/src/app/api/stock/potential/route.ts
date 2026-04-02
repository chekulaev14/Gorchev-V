import { NextResponse } from 'next/server';
import { calculateAllPotentials } from '@/services/potential.service';
import { handleRouteError } from '@/lib/api/handle-route-error';
import { withRequestId, log } from '@/lib/logger';

export const GET = withRequestId(async (req) => {
  log.info('GET /api/stock/potential: start');
  try {
    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get('itemId') ?? undefined;
    const items = await calculateAllPotentials(itemId);
    log.info('GET /api/stock/potential: done');
    return NextResponse.json({ items });
  } catch (err) {
    return handleRouteError(err);
  }
});
