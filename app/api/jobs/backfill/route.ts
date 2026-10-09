import { NextResponse } from 'next/server';
import { enqueue } from '@/lib/queue';

export async function POST() {
  // enqueue backfill job and return 202
  const job = enqueue('backfill', {});
  return NextResponse.json({ status: 'queued', job }, { status: 202 });
}
