import { NextResponse } from 'next/server';
import { getProductionLogs } from '@/services/terminal-logs.service';
import { withRequestId, log } from '@/lib/logger';

export const GET = withRequestId(async (req) => {
  log.info('GET /api/terminal/logs: start');
  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get('days') || '7');
  const workerId = searchParams.get('workerId') || undefined;

  const result = await getProductionLogs({ days, workerId });
  log.info('GET /api/terminal/logs: done');
  return NextResponse.json(result);
});
