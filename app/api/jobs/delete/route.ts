import { NextRequest, NextResponse } from 'next/server';
import { deleteJobEntry } from '@/lib/queue';
import { deleteJobResult } from '@/lib/jobs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    deleteJobEntry(id);
    deleteJobResult(id);
    return NextResponse.json({ status: 'deleted', id });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
