import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { tools, parseToolResults, SYSTEM_PROMPT } from "@/lib/tools";
import { APIAnalyzeRequest, Message } from "@/types";

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "API key not configured" },
      { status: 500 }
    );
  }

  try {
    const body: APIAnalyzeRequest = await request.json();
    const { jd, history, question } = body;

    if (!jd) {
      return NextResponse.json(
        { error: "Job description required" },
        { status: 400 }
      );
    }

    const client = new Anthropic({ apiKey });

    // Chat mode: respond to user questions
    const conversationMessages: Anthropic.MessageParam[] = [
      ...(history || []).map((msg: Message) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      {
        role: "user" as const,
        content: question || jd,
      },
    ];

    const response = await client.messages.create({
      model: "claude-3-5-sonnet-latest",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: conversationMessages,
    });

    // Extract text response
    let textResponse = "";
    for (const block of response.content) {
      if (block.type === "text") {
        textResponse = block.text;
        break;
      }
    }

    return NextResponse.json({ content: textResponse });
  } catch (error) {
    console.error("Analyze error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? `API Error: ${error.message}` : "Failed to process request" },
      { status: 500 }
    );
  }
}
