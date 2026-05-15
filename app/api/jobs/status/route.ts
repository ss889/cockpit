import { NextRequest, NextResponse } from 'next/server';
import { getJob, listJobs } from '@/lib/jobs';

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name');
  if (name) {
    return NextResponse.json({ job: getJob(name) });
  }
  return NextResponse.json({ jobs: listJobs() });
}
