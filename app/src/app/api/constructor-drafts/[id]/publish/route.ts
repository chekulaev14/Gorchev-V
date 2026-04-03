import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/api/handle-route-error';
import { withRequestId } from '@/lib/logger';
import { publishDraft } from '@/services/constructor-publish.service';

type Ctx = { params: Promise<{ id: string }> };

export const POST = withRequestId(async (_request, ctx) => {
  try {
    const { id } = await (ctx as Ctx).params;
    const result = await publishDraft(id);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
});
