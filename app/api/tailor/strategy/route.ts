import { NextRequest, NextResponse } from "next/server";
import { getLLMProvider } from "@/lib/llm";
import { JOB_STRATEGY_SYSTEM_PROMPT, isJobStrategy, normalizeJobStrategy } from "@/lib/tailoring/jobStrategy";
import type { JobStrategy } from "@/types/tailoring";

export async function POST(request: NextRequest) {
  try {
    const { jd } = await request.json();
    if (typeof jd !== "string" || !jd.trim()) {
      return NextResponse.json({ error: "Job description is required" }, { status: 400 });
    }

    const provider = getLLMProvider();
    const strategy = await provider.generateStructured<JobStrategy>({
      system: JOB_STRATEGY_SYSTEM_PROMPT,
      prompt: jd.trim(),
      maxTokens: 2400,
      validate: isJobStrategy,
    });

    return NextResponse.json({ strategy: normalizeJobStrategy(strategy) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to analyze job strategy";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}