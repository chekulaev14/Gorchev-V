import { NextResponse } from 'next/server';
import * as stockService from '@/services/stock.service';
import { getAuthContext } from '@/lib/auth-helper';
import { createMovementSchema } from '@/lib/schemas/stock.schema';
import { parseBody } from '@/lib/schemas/helpers';
import { handleRouteError } from '@/lib/api/handle-route-error';
import { withRequestId, log } from '@/lib/logger';

export const GET = withRequestId(async (req) => {
  log.info('GET /api/stock: start');
  const { searchParams } = new URL(req.url);
  const itemId = searchParams.get('itemId');

  if (itemId) {
    const [balance, movements] = await Promise.all([
      stockService.getBalance(itemId),
      stockService.getMovements(itemId, 50),
    ]);
    log.info('GET /api/stock: done');
    return NextResponse.json({ balance, movements });
  }

  const [balances, movements] = await Promise.all([
    stockService.getAllBalances(),
    stockService.getMovements(undefined, 100),
  ]);

  log.info('GET /api/stock: done');
  return NextResponse.json({ balances, movements });
});

export const POST = withRequestId(async (req) => {
  log.info('POST /api/stock: start');
  try {
    const auth = getAuthContext(req);
    const body = await req.json();
    const parsed = parseBody(createMovementSchema, body);
    if (!parsed.success) return parsed.response;

    const { action, itemId, quantity, comment, operationKey } = parsed.data;

    const item = await stockService.validateItemExists(itemId);
    if (!item) {
      return NextResponse.json({ error: 'Позиция не найдена' }, { status: 404 });
    }

    switch (action) {
      case 'SUPPLIER_INCOME': {
        const result = await stockService.createIncomeOperation({
          type: action,
          itemId,
          quantity,
          createdById: auth.actorId,
          comment,
          operationKey,
        });
        log.info('POST /api/stock: done');
        return NextResponse.json(result);
      }

      case 'SHIPMENT': {
        const result = await stockService.createShipmentOperation({
          itemId,
          quantity,
          createdById: auth.actorId,
          comment,
          operationKey,
        });
        log.info('POST /api/stock: done');
        return NextResponse.json(result);
      }

      case 'ADJUSTMENT': {
        const result = await stockService.createAdjustmentOperation({
          itemId,
          quantity,
          createdById: auth.actorId,
          comment,
          operationKey,
        });
        log.info('POST /api/stock: done');
        return NextResponse.json(result);
      }
    }
  } catch (err) {
    log.error('POST /api/stock: error', { error: String(err) });
    return handleRouteError(err);
  }
});
