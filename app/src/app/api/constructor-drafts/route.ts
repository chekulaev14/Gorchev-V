import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/api/handle-route-error';
import { withRequestId } from '@/lib/logger';
import { parseBody } from '@/lib/schemas/helpers';
import { createDraftSchema } from '@/lib/schemas/constructor-draft.schema';
import * as draftService from '@/services/constructor-draft.service';

export const GET = withRequestId(async () => {
  try {
    const drafts = await draftService.getDrafts();
    return NextResponse.json(drafts);
  } catch (err) {
    return handleRouteError(err);
  }
});

export const POST = withRequestId(async (request) => {
  try {
    const body = await request.json();
    const parsed = parseBody(createDraftSchema, body);
    if (!parsed.success) return parsed.response;

    const draft = await draftService.createDraft(parsed.data);
    return NextResponse.json(draft, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
});
