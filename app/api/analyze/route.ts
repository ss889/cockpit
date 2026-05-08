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

    // Initial analysis mode
    if (!question) {
      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        tools: tools,
        messages: [
          {
            role: "user",
            content: `Analyze this job description:\n\n${jd}\n\nUse all three tools to parse the role, analyze fit, and suggest projects.`,
          },
        ],
      });

      return NextResponse.json({ content: response.content });
    }

    // Follow-up chat mode (no tools)
    if (!history) {
      return NextResponse.json(
        { error: "Message history required for follow-up" },
        { status: 400 }
      );
    }

    // Build analysis summary from history if available
    // Look for any previous analysis results in the conversation
    const conversationMessages: Anthropic.MessageParam[] = [
      ...history.map((msg: Message) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      {
        role: "user" as const,
        content: question,
      },
    ];

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: `${SYSTEM_PROMPT}\n\nHere is the job description being analyzed:\n${jd}`,
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
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
