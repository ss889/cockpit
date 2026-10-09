import { NextRequest, NextResponse } from 'next/server';
import { APIAnalyzeRequest } from '@/types';
import { runAnalyze } from '@/lib/analyze';

export async function POST(request: NextRequest) {
  try {
    const body: APIAnalyzeRequest = await request.json();
    const { jd } = body;
    if (!jd) return NextResponse.json({ error: 'Job description required' }, { status: 400 });

    const result = await runAnalyze(jd);
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('Analyze error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `API Error: ${msg}` }, { status: 500 });
  }
}
