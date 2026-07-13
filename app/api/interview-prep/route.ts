import { NextRequest, NextResponse } from "next/server";
import { createAnthropicClient } from "@/lib/anthropicClient";
import { interviewPrepTool } from "@/lib/tools";
import type { ResumeProfile } from "@/types/profile";
import type { InterviewPrepPacket, JobDescriptionEntry, MemoryEntry } from "@/types/workspace";

type InterviewPrepToolOutput = {
  role_summary: string;
  likely_screen_questions: string[];
  technical_questions: string[];
  behavioral_questions: string[];
  talking_points: string[];
  gap_brief: string[];
  tell_me_about_yourself: string;
  why_this_role: string;
  stories: {
    prompt: string;
    answer_outline: string;
    resume_evidence: string;
  }[];
};

export async function POST(request: NextRequest) {
  try {
    const { job, profile, memories } = await request.json();

    if (!isJobDescription(job)) {
      return NextResponse.json({ error: "A saved job description is required" }, { status: 400 });
    }

    if (!isResumeProfile(profile)) {
      return NextResponse.json({ error: "Set a base resume profile before generating interview prep." }, { status: 409 });
    }

    const relevantMemories = Array.isArray(memories) ? memories.filter(isMemoryEntry).slice(0, 8) : [];
    const client = createAnthropicClient();
    const model = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";

    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      system: buildInterviewPrepPrompt(job, profile, relevantMemories),
      tools: [interviewPrepTool],
      tool_choice: { type: "tool", name: "generate_interview_prep" },
      messages: [
        {
          role: "user",
          content: "Generate the interview prep packet with the requested tool.",
        },
      ],
    });

    const output = getToolInput<InterviewPrepToolOutput>(response.content, "generate_interview_prep");
    if (!output) throw new Error("Claude did not return an interview prep tool result");

    return NextResponse.json({ prep: normalizePrepOutput(output) });
  } catch (error) {
    console.error("Interview prep error:", error);
    const message = error instanceof Error ? error.message : "Failed to generate interview prep";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function normalizePrepOutput(output: InterviewPrepToolOutput): InterviewPrepPacket {
  return {
    generatedAt: new Date().toISOString(),
    roleSummary: cleanText(output.role_summary),
    likelyScreenQuestions: cleanList(output.likely_screen_questions),
    technicalQuestions: cleanList(output.technical_questions),
    behavioralQuestions: cleanList(output.behavioral_questions),
    talkingPoints: cleanList(output.talking_points),
    gapBrief: cleanList(output.gap_brief),
    tellMeAboutYourself: cleanText(output.tell_me_about_yourself),
    whyThisRole: cleanText(output.why_this_role),
    stories: (output.stories || []).slice(0, 5).map((story) => ({
      prompt: cleanText(story.prompt),
      answerOutline: cleanText(story.answer_outline),
      resumeEvidence: cleanText(story.resume_evidence),
    })),
  };
}

function cleanList(items: string[] | undefined): string[] {
  return (items || []).map(cleanText).filter(Boolean);
}

function cleanText(value: string | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function buildInterviewPrepPrompt(job: JobDescriptionEntry, profile: ResumeProfile, memories: MemoryEntry[]): string {
  return `You are preparing a personal interview packet for one saved job.

Rules:
- Ground every answer in the resume profile, job description, and supplied memory notes
- Do not invent employers, tools, degrees, metrics, publications, leadership roles, or outcomes
- If the job asks for something not supported by the profile, put it in the gap brief with a practical way to discuss it honestly
- Write like a prepared candidate, not like a brochure
- Avoid dash punctuation in answer drafts
- Keep questions specific to this role and company where the job description supports it
- Make the story outlines usable in STAR format, but do not label every sentence mechanically
- Use plain language and concise paragraphs

Saved job:
${JSON.stringify(
    {
      title: job.title,
      company: job.company,
      url: job.url,
      description: job.text,
    },
    null,
    2
  )}

Resume profile:
${JSON.stringify(profile, null, 2)}

Relevant Memory Palace notes:
${JSON.stringify(memories, null, 2)}`;
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

function isMemoryEntry(value: unknown): value is MemoryEntry {
  if (!value || typeof value !== "object") return false;
  const memory = value as Partial<MemoryEntry>;
  return typeof memory.title === "string" && typeof memory.text === "string";
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
