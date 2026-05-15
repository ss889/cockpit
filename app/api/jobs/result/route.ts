import { NextRequest, NextResponse } from 'next/server';
import { getJobResult } from '@/lib/jobs';

export async function GET(req: NextRequest) {
  try {
    const id = String(req.nextUrl.searchParams.get('id') || '');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const result = getJobResult(id);
    if (!result) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json({ id, result });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
