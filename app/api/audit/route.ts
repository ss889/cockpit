import { NextRequest, NextResponse } from "next/server";
import {
  assessKeywordPresenceTool,
  buildAuditReport,
  extractJdKeywordsTool,
  normalizeKeywordGroups,
  normalizeKeywordResults,
  renderAuditResumeText,
  type KeywordPresenceToolOutput,
} from "@/lib/audit";
import { runFormatChecks } from "@/lib/audit-format";
import { createAnthropicClient } from "@/lib/anthropicClient";
import type { AuditKeywordGroups } from "@/types/audit";
import type { ResumeProfile } from "@/types/profile";
import type { JobDescriptionEntry } from "@/types/workspace";

export async function POST(request: NextRequest) {
  try {
    const { job, profile } = await request.json();

    if (!isJobDescription(job)) {
      return NextResponse.json({ error: "A saved job description is required." }, { status: 400 });
    }

    if (!isResumeProfile(profile)) {
      return NextResponse.json({ error: "Set a base resume profile before running an ATS audit." }, { status: 409 });
    }

    const resumeText = renderAuditResumeText(profile);
    const keywordGroups = await extractKeywords(job.text);
    const keywordResults = await assessKeywordPresence(keywordGroups, resumeText);
    const formatResults = runFormatChecks(resumeText);

    if (keywordResults.length === 0) {
      return NextResponse.json({ error: "No audit keywords were returned. Try again with a fuller job description." }, { status: 422 });
    }

    return NextResponse.json({
      report: buildAuditReport(keywordResults, formatResults),
    });
  } catch (error) {
    console.error("ATS audit error:", error);
    const message = error instanceof Error ? error.message : "Failed to run ATS audit";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function extractKeywords(jd: string): Promise<AuditKeywordGroups> {
  const client = createAnthropicClient();
  const model = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";

  const response = await client.messages.create({
    model,
    max_tokens: 1200,
    temperature: 0,
    system:
      "Extract ATS keywords from this job description. Return at most 25 total keywords. Prioritize terms repeated in the JD or explicitly listed under requirements. Keep keywords short, scannable, and useful for ATS matching. Do not include generic filler.",
    tools: [extractJdKeywordsTool],
    tool_choice: { type: "tool", name: "extract_jd_keywords" },
    messages: [
      {
        role: "user",
        content: jd,
      },
    ],
  });

  const output = getToolInput<Partial<AuditKeywordGroups>>(response.content, "extract_jd_keywords");
  if (!output) throw new Error("Claude did not return JD keywords.");
  return normalizeKeywordGroups(output);
}

async function assessKeywordPresence(
  keywordGroups: AuditKeywordGroups,
  resumeText: string
) {
  const client = createAnthropicClient();
  const model = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";

  const response = await client.messages.create({
    model,
    max_tokens: 3000,
    temperature: 0,
    system:
      "Assess keyword presence in the resume. Use present only when the exact term or a very clear equivalent appears. Use weak when the concept exists but the ATS keyword is not explicit. Use missing when it is not supported. Set honesty_flag only from resume evidence: safe if clearly supported, verify_first if adjacent but not direct, do_not_add if unsupported. Return every keyword exactly once.",
    tools: [assessKeywordPresenceTool],
    tool_choice: { type: "tool", name: "assess_keyword_presence" },
    messages: [
      {
        role: "user",
        content: JSON.stringify({ keywords: keywordGroups, resumeText }, null, 2),
      },
    ],
  });

  const output = getToolInput<KeywordPresenceToolOutput>(response.content, "assess_keyword_presence");
  if (!output) throw new Error("Claude did not return keyword presence results.");
  return normalizeKeywordResults(keywordGroups, output);
}

function isJobDescription(value: unknown): value is JobDescriptionEntry {
  if (!value || typeof value !== "object") return false;
  const job = value as Partial<JobDescriptionEntry>;
  return typeof job.id === "string" && typeof job.text === "string" && job.text.trim().length > 0;
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
