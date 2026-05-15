import { NextRequest, NextResponse } from 'next/server';
import { cancelJob } from '@/lib/queue';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    cancelJob(id);
    return NextResponse.json({ status: 'cancelled', id });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
