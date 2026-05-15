import { NextRequest, NextResponse } from 'next/server';
import { listJobs } from '@/lib/jobs';

export async function GET(req: NextRequest) {
  const jobs = listJobs();
  const inProgress = Object.values(jobs).some((j: any) => j.inProgress === true);
  const lastFinishedTimes = Object.values(jobs)
    .map((j: any) => j.finishedAt)
    .filter(Boolean)
    .map((t: string) => new Date(t).getTime());
  const lastFinished = lastFinishedTimes.length ? Math.max(...lastFinishedTimes) : null;
  const now = Date.now();
  const healthy = inProgress || (lastFinished && now - lastFinished < 1000 * 60 * 10); // worker active within 10m
  return NextResponse.json({ healthy, inProgress, lastFinished });
}
