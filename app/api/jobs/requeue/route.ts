import { NextRequest, NextResponse } from 'next/server';
import { requeueJob } from '@/lib/queue';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    requeueJob(id);
    return NextResponse.json({ status: 'requeued', id });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
