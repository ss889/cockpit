import { NextRequest, NextResponse } from 'next/server';
import { scheduleJob } from '@/lib/queue';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, payload = {}, delayMinutes, runAt, maxRetries = 3 } = body || {};

    if (!type) {
      return NextResponse.json({ error: 'type required' }, { status: 400 });
    }

    if (!delayMinutes && !runAt) {
      return NextResponse.json({ error: 'delayMinutes or runAt required' }, { status: 400 });
    }

    const job = scheduleJob(type, payload, {
      maxRetries,
      ...(runAt ? { nextRun: runAt } : {}),
      ...(delayMinutes !== undefined ? { delayMinutes } : {}),
    });

    return NextResponse.json({ status: 'scheduled', job });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}