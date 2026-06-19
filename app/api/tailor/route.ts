import { NextRequest, NextResponse } from "next/server";
import { createAnthropicClient } from "@/lib/anthropicClient";
import { getBaseProfile } from "@/lib/database";
import { extractKeywords } from "@/lib/ollama";
import { renderResumeLatex } from "@/lib/renderLatex";
import { collectBullets, runQA } from "@/lib/resumeQA";
import { reviseResumeBulletsTool, tailorResumeTool } from "@/lib/tools";
import type { QAIssue, ResumeProfile } from "@/types/profile";

interface TailorToolOutput {
  selected_project_ids: string[];
  rewritten_projects: { id: string; bullets: string[] }[];
  rewritten_experience: { id: string; bullets: string[] }[];
  updated_skills: ResumeProfile["skills"];
}

interface RevisionToolOutput {
  revisions: { location: string; bullet: string }[];
}

export async function POST(request: NextRequest) {
  try {
    const { jd, profile } = await request.json();
    if (!jd || typeof jd !== "string") {
      return NextResponse.json({ error: "Job description is required" }, { status: 400 });
    }

    const baseProfile = isResumeProfile(profile) ? profile : getBaseProfile();
    if (!baseProfile) {
      return NextResponse.json(
        { error: "Set a base resume profile before tailoring. Paste your .tex resume in the Tailor Resume panel first." },
        { status: 409 }
      );
    }

    const keywords = await extractKeywords(jd);
    const tailored = await tailorProfile(baseProfile, jd, keywords);
    const before = runQA(tailored, keywords);

    let finalProfile = tailored;
    let after = before;
    let autoFixed = false;

    const fixable = before.filter((issue) => issue.location.includes(":"));
    if (fixable.length > 0) {
      const revised = await reviseFlaggedBullets(tailored, fixable);
      if (revised) {
        finalProfile = revised;
        after = runQA(finalProfile, keywords);
        autoFixed = after.length < before.length;
      }
    }

    return NextResponse.json({
      profile: finalProfile,
      latex: renderResumeLatex(finalProfile),
      keywords,
      qa: {
        before,
        after,
        autoFixed,
      },
    });
  } catch (error) {
    console.error("Tailor error:", error);
    const message = error instanceof Error ? error.message : "Failed to tailor resume";
    return NextResponse.json({ error: message }, { status: 500 });
  }
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

async function tailorProfile(baseProfile: ResumeProfile, jd: string, keywords: string[]): Promise<ResumeProfile> {
  const client = createAnthropicClient();
  const model = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";

  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    system: buildTailorPrompt(baseProfile, jd, keywords),
    tools: [tailorResumeTool],
    tool_choice: { type: "tool", name: "tailor_resume" },
    messages: [
      {
        role: "user",
        content: "Tailor the base profile to the job description using the requested tool.",
      },
    ],
  });

  const output = getToolInput<TailorToolOutput>(response.content, "tailor_resume");
  if (!output) throw new Error("Claude did not return a tailored resume tool result");

  return applyTailoring(baseProfile, output);
}

async function reviseFlaggedBullets(profile: ResumeProfile, issues: QAIssue[]): Promise<ResumeProfile | null> {
  const flagged = collectBullets(profile).filter((bullet) =>
    issues.some((issue) => issue.location === bullet.location)
  );

  if (flagged.length === 0) return null;

  const client = createAnthropicClient();
  const model = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";

  const response = await client.messages.create({
    model,
    max_tokens: 2048,
    system:
      "Fix only these specific issues in the bullets below. Do not change anything else. Never invent facts, tools, metrics, or experience. Remove em dashes, avoid generic AI-sounding phrases, vary opening verbs, and keep each bullet one sentence.",
    tools: [reviseResumeBulletsTool],
    tool_choice: { type: "tool", name: "revise_resume_bullets" },
    messages: [
      {
        role: "user",
        content: JSON.stringify({ issues, bullets: flagged }, null, 2),
      },
    ],
  });

  const output = getToolInput<RevisionToolOutput>(response.content, "revise_resume_bullets");
  if (!output?.revisions?.length) return null;

  return applyRevisions(profile, output.revisions);
}

function applyTailoring(baseProfile: ResumeProfile, output: TailorToolOutput): ResumeProfile {
  const selectedIds = new Set(
    (output.selected_project_ids?.length ? output.selected_project_ids : baseProfile.projects.map((project) => project.id))
  );
  const projectRewrites = new Map(output.rewritten_projects?.map((project) => [project.id, project.bullets]) ?? []);
  const experienceRewrites = new Map(output.rewritten_experience?.map((experience) => [experience.id, experience.bullets]) ?? []);

  return {
    header: baseProfile.header,
    education: baseProfile.education,
    skills: output.updated_skills?.length ? output.updated_skills : baseProfile.skills,
    projects: baseProfile.projects
      .filter((project) => selectedIds.has(project.id))
      .map((project) => ({
        ...project,
        bullets: sanitizeBullets(projectRewrites.get(project.id) ?? project.bullets),
      })),
    experience: baseProfile.experience.map((experience) => ({
      ...experience,
      bullets: sanitizeBullets(experienceRewrites.get(experience.id) ?? experience.bullets),
    })),
  };
}

function applyRevisions(profile: ResumeProfile, revisions: { location: string; bullet: string }[]): ResumeProfile {
  const revisionMap = new Map(revisions.map((revision) => [revision.location, revision.bullet]));

  return {
    ...profile,
    projects: profile.projects.map((project) => ({
      ...project,
      bullets: project.bullets.map((bullet, index) =>
        sanitizeBullet(revisionMap.get(`project:${project.id}:${index}`) ?? bullet)
      ),
    })),
    experience: profile.experience.map((experience) => ({
      ...experience,
      bullets: experience.bullets.map((bullet, index) =>
        sanitizeBullet(revisionMap.get(`experience:${experience.id}:${index}`) ?? bullet)
      ),
    })),
  };
}

function sanitizeBullets(bullets: string[]): string[] {
  return bullets.map(sanitizeBullet).filter(Boolean);
}

function sanitizeBullet(bullet: string): string {
  return String(bullet || "")
    .replace(/[—–]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function buildTailorPrompt(baseProfile: ResumeProfile, jd: string, keywords: string[]): string {
  return `You are tailoring a resume to match a specific job description.

Rules you must follow:
- Never invent facts, tools, metrics, or experience not present in the base profile
- Rephrase bullets to naturally incorporate the job description's language where the underlying fact supports it
- Vary action verbs across bullets, do not repeat the same opening verb more than twice in the full resume
- Do not use em dashes anywhere in bullet text
- Avoid generic AI-sounding phrases: leveraged, spearheaded, architected, robust, seamless, cutting-edge, utilize, synergy
- Keep each bullet as a single sentence, specific and concrete
- If the base profile has more projects than reasonably fit, select the most relevant ones rather than including everything

Base profile:
${JSON.stringify(baseProfile, null, 2)}

Job description:
${jd}

Extracted keywords to weave in naturally where truthful:
${keywords.join(", ")}`;
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
