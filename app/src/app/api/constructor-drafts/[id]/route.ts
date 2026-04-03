import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/api/handle-route-error';
import { withRequestId } from '@/lib/logger';
import { parseBody } from '@/lib/schemas/helpers';
import { updateDraftSchema } from '@/lib/schemas/constructor-draft.schema';
import * as draftService from '@/services/constructor-draft.service';

type Ctx = { params: Promise<{ id: string }> };

export const GET = withRequestId(async (_request, ctx) => {
  try {
    const { id } = await (ctx as Ctx).params;
    const draft = await draftService.getDraft(id);
    return NextResponse.json(draft);
  } catch (err) {
    return handleRouteError(err);
  }
});

export const PUT = withRequestId(async (request, ctx) => {
  try {
    const { id } = await (ctx as Ctx).params;
    const body = await request.json();
    const parsed = parseBody(updateDraftSchema, body);
    if (!parsed.success) return parsed.response;

    const draft = await draftService.updateDraft(id, parsed.data);
    return NextResponse.json(draft);
  } catch (err) {
    return handleRouteError(err);
  }
});

export const DELETE = withRequestId(async (_request, ctx) => {
  try {
    const { id } = await (ctx as Ctx).params;
    await draftService.deleteDraft(id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
});
