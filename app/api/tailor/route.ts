import { NextRequest, NextResponse } from "next/server";
import { createAnthropicClient } from "@/lib/anthropicClient";
import { getBaseProfile } from "@/lib/database";
import { extractKeywords } from "@/lib/ollama";
import { renderResumeLatex } from "@/lib/renderLatex";
import { sanitizeBullet } from "@/lib/resumeEdit";
import { collectBullets, runQA } from "@/lib/resumeQA";
import { reviseResumeBulletsTool, tailorResumeTool } from "@/lib/tools";
import type { MatchAssessment, QAIssue, ResumeProfile } from "@/types/profile";

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
    const [tailored, match] = await Promise.all([
      tailorProfile(baseProfile, jd, keywords),
      assessMatch(baseProfile, keywords),
    ]);
    const before = runQA(tailored, keywords);

    let finalProfile = tailored;
    let after = before;
    let autoFixed = false;

    for (let pass = 0; pass < 2; pass += 1) {
      const fixable = after.filter((issue) => issue.location.includes(":"));
      if (fixable.length === 0) break;

      const revised = await reviseFlaggedBullets(finalProfile, fixable, baseProfile);
      if (revised) {
        const revisedIssues = runQA(revised, keywords);
        if (revisedIssues.length > after.length) break;
        finalProfile = revised;
        after = revisedIssues;
        autoFixed = after.length < before.length;
      } else {
        break;
      }
    }

    return NextResponse.json({
      profile: finalProfile,
      latex: renderResumeLatex(finalProfile),
      keywords,
      match,
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

async function assessMatch(baseProfile: ResumeProfile, keywords: string[]): Promise<MatchAssessment> {
  const fallback: MatchAssessment = {
    score: 50,
    strong: [],
    gaps: [],
    recommendation: "Match assessment unavailable.",
  };

  try {
    const client = createAnthropicClient();
    const model = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";

    const response = await client.messages.create({
      model,
      max_tokens: 512,
      system: `You are a resume match evaluator. Compare the extracted JD keywords against the base profile. Return only valid JSON with no markdown and no preamble.

Schema:
{
  "score": number,
  "strong": string[],
  "gaps": string[],
  "recommendation": string
}

Rules:
- Score must be an integer from 0 to 100
- strong includes only keywords clearly present in the profile
- gaps includes required keywords clearly absent from the profile
- recommendation is one honest sentence: strong match, apply with caveats, or weak match`,
      messages: [
        {
          role: "user",
          content: JSON.stringify({ keywords, profile: baseProfile }, null, 2),
        },
      ],
    });

    const text = extractTextContent(response.content);
    return normalizeMatchAssessment(JSON.parse(text));
  } catch {
    return fallback;
  }
}

async function reviseFlaggedBullets(
  profile: ResumeProfile,
  issues: QAIssue[],
  baseProfile: ResumeProfile
): Promise<ResumeProfile | null> {
  const flagged = collectBullets(profile).filter((bullet) =>
    issues.some((issue) => issue.location === bullet.location)
  );

  if (flagged.length === 0) return null;

  const client = createAnthropicClient();
  const model = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";

  const response = await client.messages.create({
    model,
    max_tokens: 2048,
    system: `Fix only the specific QA issues listed. Do not change any bullet that is not flagged. Never introduce a fact, tool, metric, number, or timeframe that is not present in the base profile below.

When fixing a weak or vague bullet, strengthen it only using facts, tools, and scope signals that are already in the base profile. If no supporting fact exists, leave the bullet as-is rather than inventing one.

Style rules: plain verbs, concrete nouns, no dash punctuation, no AI phrases, one sentence per bullet, under 32 words when possible. For experience bullets, use XYZ shape only when truthful and supported by the base profile.

Base profile source of truth:
${JSON.stringify(baseProfile, null, 2)}`,
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
    skills: output.updated_skills?.length
      ? validateSkills(output.updated_skills, baseProfile.skills)
      : baseProfile.skills,
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

export function validateSkills(
  proposed: ResumeProfile["skills"],
  base: ResumeProfile["skills"]
): ResumeProfile["skills"] {
  const baseCategories = new Set(base.map((category) => category.category.toLowerCase()));
  const baseItems = new Set<string>();

  for (const category of base) {
    for (const item of category.items) {
      baseItems.add(item.toLowerCase());
    }
  }

  const validated = proposed
    .filter((category) => baseCategories.has(category.category.toLowerCase()))
    .map((category) => ({
      ...category,
      items: category.items.filter((item) => skillMatches(item, baseItems)),
    }))
    .filter((category) => category.items.length > 0);

  return validated.length > 0 ? validated : base;
}

function skillMatches(proposed: string, baseItems: Set<string>): boolean {
  const normalized = proposed.toLowerCase();
  for (const baseItem of baseItems) {
    if (normalized === baseItem || normalized.includes(baseItem) || baseItem.includes(normalized)) {
      return true;
    }
  }
  return false;
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

function buildTailorPrompt(baseProfile: ResumeProfile, jd: string, keywords: string[]): string {
  return `You are tailoring a resume to match a specific job description.

Rules you must follow:
- Never invent facts, tools, metrics, or experience not present in the base profile
- Rephrase bullets to naturally incorporate the job description's language where the underlying fact supports it
- Vary action verbs across bullets, do not repeat the same opening verb more than twice in the full resume
- Do not use dash punctuation in bullet text, including em dashes, en dashes, and spaced hyphens
- Avoid generic AI-sounding phrases: leveraged, spearheaded, architected, robust, seamless, cutting-edge, utilize, synergy, end-to-end, scalable solution, innovative solution, results-driven, detail-oriented
- Do not mirror the job description word-for-word; use only terms that fit the actual project or experience
- Prefer plain human verbs such as built, improved, shipped, tested, cleaned, deployed, wrote, added, reduced, tracked, and documented
- Keep each bullet as a single sentence, specific and concrete, usually 18 to 28 words
- Include numbers only when they already exist in the base profile or are directly supported by it
- Avoid inflated adjectives, marketing language, and vague claims about impact
- For experience bullets, follow Google's XYZ shape when truthful: achieved X, measured or scoped by Y, by doing Z
- If there is no real metric, use an honest scope signal such as records, rows, files, tests, dashboards, workflows, datasets, responses, or scheduled runs from the base profile
- Keep the LaTeX ATS-friendly: standard section names, simple bullets, no tables, no text boxes, no graphics, and no multi-column layout
- If the base profile has more projects than reasonably fit, select the most relevant ones rather than including everything

Base profile:
${JSON.stringify(baseProfile, null, 2)}

Job description:
${jd}

Extracted keywords to weave in naturally where truthful:
${keywords.join(", ")}`;
}

function extractTextContent(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return content
    .map((block) => {
      if (!block || typeof block !== "object") return "";
      const typed = block as { type?: unknown; text?: unknown };
      return typed.type === "text" && typeof typed.text === "string" ? typed.text : "";
    })
    .join("")
    .trim();
}

function normalizeMatchAssessment(value: unknown): MatchAssessment {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid match assessment");
  }

  const assessment = value as Partial<MatchAssessment>;
  const score = Number(assessment.score);

  return {
    score: Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 50,
    strong: Array.isArray(assessment.strong) ? assessment.strong.map(String).filter(Boolean) : [],
    gaps: Array.isArray(assessment.gaps) ? assessment.gaps.map(String).filter(Boolean) : [],
    recommendation:
      typeof assessment.recommendation === "string" && assessment.recommendation.trim()
        ? assessment.recommendation.trim()
        : "Match assessment unavailable.",
  };
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
