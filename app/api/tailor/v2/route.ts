import { NextRequest, NextResponse } from "next/server";
import { getLLMProvider } from "@/lib/llm";
import { buildResumeEvidence } from "@/lib/tailoring/evidence";
import { generateGroundedBullets, applyGeneratedBullets } from "@/lib/tailoring/generation";
import { mapRequirementsToEvidence } from "@/lib/tailoring/mapping";
import { normalizeJobStrategy, JOB_STRATEGY_SYSTEM_PROMPT } from "@/lib/tailoring/jobStrategy";
import { planResumeStrategy } from "@/lib/tailoring/strategy";
import { verifyGeneratedBullets } from "@/lib/tailoring/verification";
import { renderResumeLatex } from "@/lib/renderLatex";
import { runQA } from "@/lib/resumeQA";
import type { ResumeProfile } from "@/types/profile";
import type { JobStrategy } from "@/types/tailoring";

export async function POST(request: NextRequest) {
  try {
    const { jd, profile } = await request.json();
    if (typeof jd !== "string" || !jd.trim()) {
      return NextResponse.json({ error: "Job description is required" }, { status: 400 });
    }
    if (!isResumeProfile(profile)) {
      return NextResponse.json({ error: "A base resume profile is required" }, { status: 409 });
    }

    const provider = getLLMProvider();
    const rawStrategy = await provider.generateStructured<JobStrategy>({
      system: JOB_STRATEGY_SYSTEM_PROMPT,
      prompt: jd.trim(),
      maxTokens: 2400,
      validate: (value): value is JobStrategy => Boolean(value && typeof value === "object" && typeof (value as JobStrategy).role === "string"),
    });
    const jobStrategy = normalizeJobStrategy(rawStrategy);
    const evidence = buildResumeEvidence(profile);
    const requirementMap = mapRequirementsToEvidence(
      [...jobStrategy.mustHaveRequirements, ...jobStrategy.preferredRequirements],
      evidence,
    );
    const resumeStrategy = planResumeStrategy(jobStrategy, evidence, requirementMap);
    const generatedBullets = await generateGroundedBullets(
      profile,
      jobStrategy,
      resumeStrategy,
      evidence,
      requirementMap,
      provider,
    );
    const verification = verifyGeneratedBullets(generatedBullets, evidence);
    const generatedProfile = applyGeneratedBullets(profile, generatedBullets);
    const selectedProjects = new Set(resumeStrategy.projectsToInclude);
    const finalProfile = selectedProjects.size > 0
      ? { ...generatedProfile, projects: generatedProfile.projects.filter((project) => selectedProjects.has(project.title)) }
      : generatedProfile;
    const qa = runQA(finalProfile, jobStrategy.keywords);

    return NextResponse.json({
      strategy: jobStrategy,
      evidence,
      requirementMap,
      resumeStrategy,
      generatedBullets,
      verification,
      qa,
      profile: finalProfile,
      latex: renderResumeLatex(finalProfile),
      ready: verification.passed && qa.length === 0,
      provider: provider.getProviderName(),
      model: provider.getModelName(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Strategic tailoring failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function isResumeProfile(value: unknown): value is ResumeProfile {
  if (!value || typeof value !== "object") return false;
  const profile = value as Partial<ResumeProfile>;
  return Boolean(
    profile.header &&
    Array.isArray(profile.education) &&
    Array.isArray(profile.skills) &&
    Array.isArray(profile.projects) &&
    Array.isArray(profile.experience),
  );
}