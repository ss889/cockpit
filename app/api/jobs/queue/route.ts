import { NextRequest, NextResponse } from 'next/server';
import { listQueue } from '@/lib/queue';

export async function GET(req: NextRequest) {
  const q = listQueue();
  const now = Date.now();
  const stats = {
    total: q.length,
    pending: q.filter((j: any) => j.status === 'pending').length,
    deferred: q.filter((j: any) => j.status === 'pending' && new Date(j.nextRun).getTime() > now).length,
    running: q.filter((j: any) => j.status === 'running').length,
    done: q.filter((j: any) => j.status === 'done').length,
    failed: q.filter((j: any) => j.status === 'failed').length,
  };
  return NextResponse.json({ stats, jobs: q.slice(0, 200) });
}
