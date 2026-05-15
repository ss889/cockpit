import { NextRequest, NextResponse } from 'next/server';
import { listResults } from '@/lib/jobs';

export async function GET(_req: NextRequest) {
  try {
    const results = listResults();
    // return as array of { id, result }
    const arr = Object.keys(results).map((id) => ({ id, result: results[id] }));
    return NextResponse.json({ results: arr });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
