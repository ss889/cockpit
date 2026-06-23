import { NextRequest, NextResponse } from "next/server";
import { createAnthropicClient } from "@/lib/anthropicClient";
import { applyResumeEdits, editedLocations, type ResumeEdit } from "@/lib/resumeEdit";
import { runQA } from "@/lib/resumeQA";
import { editResumeTool } from "@/lib/tools";
import type { Message } from "@/types";
import type { QAIssue, ResumeProfile } from "@/types/profile";

interface EditToolOutput {
  explanation: string;
  edits: ResumeEdit[];
}

export async function POST(request: NextRequest) {
  try {
    const { draftProfile, jd, keywords, history, message } = await request.json();

    if (!isResumeProfile(draftProfile)) {
      return NextResponse.json({ error: "Current draft profile is required" }, { status: 400 });
    }
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Refinement message is required" }, { status: 400 });
    }

    const client = createAnthropicClient();
    const model = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";
    const safeHistory = normalizeHistory(history);
    const safeKeywords = Array.isArray(keywords) ? keywords.map(String) : [];

    const response = await client.messages.create({
      model,
      max_tokens: 1000,
      system: buildRefinePrompt(draftProfile, String(jd || ""), safeKeywords),
      tools: [editResumeTool],
      tool_choice: { type: "tool", name: "edit_resume_section" },
      messages: [
        ...safeHistory.map((item) => ({
          role: item.role as "user" | "assistant",
          content: item.content,
        })),
        {
          role: "user" as const,
          content: message,
        },
      ],
    });

    const output = getToolInput<EditToolOutput>(response.content, "edit_resume_section");
    if (!output) {
      return NextResponse.json({ error: "Claude did not return a targeted edit" }, { status: 502 });
    }

    const validEdits = (output.edits || []).filter(isValidEdit);
    const updatedProfile = applyResumeEdits(draftProfile, validEdits);
    const edited = new Set(editedLocations(validEdits));
    const newIssues = runQA(updatedProfile, safeKeywords).filter((issue) => issueTouchesEdit(issue, edited));

    return NextResponse.json({
      explanation: output.explanation || "I made a targeted resume edit.",
      updatedProfile,
      edits: validEdits,
      newIssues,
    });
  } catch (error) {
    console.error("Tailor chat error:", error);
    const message = error instanceof Error ? error.message : "Failed to refine resume";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function buildRefinePrompt(draftProfile: ResumeProfile, jd: string, keywords: string[]): string {
  return `You are refining a tailored resume through conversation. The user will ask for specific changes. Make targeted edits only, never rewrite bullets that were not mentioned.

Style constraints:
- No fabrication, no unsupported metrics, and no inflated claims
- No dash punctuation in bullet text, including em dashes, en dashes, and spaced hyphens
- No generic AI phrases such as leveraged, spearheaded, architected, robust, seamless, cutting-edge, utilize, synergy, end-to-end, scalable solution, innovative solution, results-driven, detail-oriented
- Use plain human verbs and concrete nouns
- Keep bullets one sentence and usually 18 to 28 words
- Avoid copying the job description word-for-word unless the wording is a truthful skill or tool name

Return edits only through the edit_resume_section tool. Locations must be exactly project:<id> or experience:<id>, and bullet_index is zero-based.

Current draft profile:
${JSON.stringify(draftProfile, null, 2)}

Original job description:
${jd}

Target keywords:
${keywords.join(", ")}`;
}

function issueTouchesEdit(issue: QAIssue, edited: Set<string>): boolean {
  if (edited.has(issue.location)) return true;
  if (issue.location === "global") return true;
  return false;
}

function normalizeHistory(history: unknown): Message[] {
  if (!Array.isArray(history)) return [];
  return history
    .filter((item): item is Message => {
      if (!item || typeof item !== "object") return false;
      const msg = item as Partial<Message>;
      return (msg.role === "user" || msg.role === "assistant") && typeof msg.content === "string";
    })
    .slice(-8);
}

function isResumeProfile(value: unknown): value is ResumeProfile {
  if (!value || typeof value !== "object") return false;
  const profile = value as Partial<ResumeProfile>;
  return (
    !!profile.header &&
    Array.isArray(profile.education) &&
    Array.isArray(profile.skills) &&
    Array.isArray(profile.projects) &&
    Array.isArray(profile.experience)
  );
}

function isValidEdit(value: unknown): value is ResumeEdit {
  if (!value || typeof value !== "object") return false;
  const edit = value as Partial<ResumeEdit>;
  return (
    typeof edit.location === "string" &&
    (edit.location.startsWith("project:") || edit.location.startsWith("experience:")) &&
    typeof edit.bullet_index === "number" &&
    Number.isInteger(edit.bullet_index) &&
    edit.bullet_index >= 0 &&
    typeof edit.new_text === "string" &&
    edit.new_text.trim().length > 0
  );
}

function getToolInput<T>(content: unknown, toolName: string): T | null {
  if (!Array.isArray(content)) return null;
  for (const block of content) {
    if (
      typeof block === "object" &&
      block !== null &&
      "type" in block &&
      "name" in block &&
      "input" in block &&
      block.type === "tool_use" &&
      block.name === toolName
    ) {
      return block.input as T;
    }
  }
  return null;
}
