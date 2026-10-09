import { NextResponse } from 'next/server';
import { listQueue } from '@/lib/queue';

type QueueJob = {
  status?: string;
  nextRun?: string | null;
};

export async function GET() {
  const q = listQueue() as QueueJob[];
  const now = Date.now();
  const stats = {
    total: q.length,
    pending: q.filter((j) => j.status === 'pending').length,
    deferred: q.filter((j) => j.status === 'pending' && j.nextRun && new Date(j.nextRun).getTime() > now).length,
    running: q.filter((j) => j.status === 'running').length,
    done: q.filter((j) => j.status === 'done').length,
    failed: q.filter((j) => j.status === 'failed').length,
  };
  return NextResponse.json({ stats, jobs: q.slice(0, 200) });
}
