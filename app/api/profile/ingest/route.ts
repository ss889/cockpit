import { NextRequest, NextResponse } from "next/server";
import { createAnthropicClient } from "@/lib/anthropicClient";
import { saveBaseProfile } from "@/lib/database";
import { extractProfileTool } from "@/lib/tools";
import type { ResumeProfile } from "@/types/profile";

export async function POST(request: NextRequest) {
  try {
    const { latex } = await request.json();
    if (!latex || typeof latex !== "string") {
      return NextResponse.json({ error: "Resume source text is required" }, { status: 400 });
    }

    const client = createAnthropicClient();
    const model = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";

    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      system:
        "Parse the provided resume into the exact structured schema requested. The source may be LaTeX, PDF-extracted plain text, or pasted resume text. Preserve all text exactly as written, do not paraphrase or summarize. Each project and experience entry must have its bullets as separate array items, stripped of LaTeX commands or formatting artifacts but preserving the actual words. Assign stable lowercase ids based on each project or experience title.",
      tools: [extractProfileTool],
      tool_choice: { type: "tool", name: "extract_resume_profile" },
      messages: [
        {
          role: "user",
          content: latex,
        },
      ],
    });

    const profile = getToolInput<ResumeProfile>(response.content, "extract_resume_profile");
    if (!profile) {
      return NextResponse.json({ error: "Could not parse resume profile" }, { status: 502 });
    }

    const normalized = normalizeProfile(profile);
    saveBaseProfile(normalized);

    return NextResponse.json({
      profile: normalized,
      counts: {
        projects: normalized.projects.length,
        projectBullets: normalized.projects.reduce((sum, project) => sum + project.bullets.length, 0),
        experience: normalized.experience.length,
        experienceBullets: normalized.experience.reduce((sum, experience) => sum + experience.bullets.length, 0),
      },
    });
  } catch (error) {
    console.error("Profile ingestion error:", error);
    const message = error instanceof Error ? error.message : "Failed to ingest resume";
    return NextResponse.json({ error: message }, { status: 500 });
  }
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

function normalizeProfile(profile: ResumeProfile): ResumeProfile {
  return {
    header: {
      name: profile.header?.name || "",
      phone: profile.header?.phone || "",
      email: profile.header?.email || "",
      linkedin: profile.header?.linkedin || "",
      github: profile.header?.github || "",
    },
    education: Array.isArray(profile.education) ? profile.education : [],
    skills: Array.isArray(profile.skills) ? profile.skills : [],
    projects: (Array.isArray(profile.projects) ? profile.projects : []).map((project, index) => ({
      ...project,
      id: project.id || slugify(project.title || `project-${index + 1}`),
      bullets: Array.isArray(project.bullets) ? project.bullets : [],
    })),
    experience: (Array.isArray(profile.experience) ? profile.experience : []).map((experience, index) => ({
      ...experience,
      id: experience.id || slugify(experience.title || `experience-${index + 1}`),
      bullets: Array.isArray(experience.bullets) ? experience.bullets : [],
    })),
  };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
