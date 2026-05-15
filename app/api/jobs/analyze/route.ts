import { NextRequest, NextResponse } from 'next/server';
import { enqueue, scheduleJob } from '@/lib/queue';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { jd, delayMinutes, runAt } = body;
    if (!jd) return NextResponse.json({ error: 'jd required' }, { status: 400 });
    const scheduleOpts = {
      maxRetries: 2,
      ...(runAt ? { nextRun: runAt } : {}),
      ...(delayMinutes !== undefined ? { delayMinutes } : {}),
    };
    const job = delayMinutes !== undefined || runAt ? scheduleJob('analyze', { jd }, scheduleOpts) : enqueue('analyze', { jd }, scheduleOpts);
    return NextResponse.json({ status: 'queued', job });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
