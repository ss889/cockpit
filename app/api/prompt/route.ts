import { NextRequest, NextResponse } from 'next/server';
import { getSystemPrompt, setSystemPrompt, resetSystemPrompt, DEFAULT_SYSTEM_PROMPT } from '@/lib/promptStore';

export async function GET() {
  return NextResponse.json({ prompt: getSystemPrompt() });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body || typeof body.prompt !== 'string') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    setSystemPrompt(body.prompt);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to set prompt' }, { status: 500 });
  }
}

export async function DELETE() {
  resetSystemPrompt();
  return NextResponse.json({ success: true });
}
