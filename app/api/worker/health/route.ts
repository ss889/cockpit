import { NextResponse } from 'next/server';
import { listJobs } from '@/lib/jobs';

type JobStatus = {
  inProgress?: boolean;
  finishedAt?: string | null;
};

export async function GET() {
  const jobs = listJobs() as Record<string, JobStatus>;
  const inProgress = Object.values(jobs).some((j) => j.inProgress === true);
  const lastFinishedTimes = Object.values(jobs)
    .map((j) => j.finishedAt)
    .filter((value): value is string => Boolean(value))
    .map((t) => new Date(t).getTime());
  const lastFinished = lastFinishedTimes.length ? Math.max(...lastFinishedTimes) : null;
  const now = Date.now();
  const healthy = inProgress || (lastFinished !== null && now - lastFinished < 1000 * 60 * 10); // worker active within 10m
  return NextResponse.json({ healthy, inProgress, lastFinished });
}
