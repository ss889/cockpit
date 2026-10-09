import type { LLMProvider } from "@/lib/llm";
import { sanitizeBullet } from "@/lib/resumeEdit";
import type { ResumeProfile } from "@/types/profile";
import type {
  GeneratedBullet,
  JobStrategy,
  RequirementEvidenceMap,
  ResumeEvidence,
  ResumeStrategy,
} from "@/types/tailoring";

export type GeneratedBulletOutput = {
  bullets: GeneratedBullet[];
};

export const GROUNDED_GENERATION_SYSTEM_PROMPT = `You are generating tailored resume bullets after strategy and evidence analysis.

Use only the supplied verified evidence. Never invent metrics, tools, responsibilities, employers, dates, users, clients, scope, or achievements. A missing requirement is a gap, not permission to fabricate.

Rewrite only bullets that support the resume strategy. Preserve or omit less relevant content according to the strategy and content budget. Keep each bullet one sentence, concrete, ATS-readable, and under 32 words when possible. Use job terminology only when the evidence supports the underlying claim.

Every generated bullet must cite one or more exact evidence IDs and one or more target requirement texts. Return only the requested JSON structure.`;

export async function generateGroundedBullets(
  profile: ResumeProfile,
  jobStrategy: JobStrategy,
  resumeStrategy: ResumeStrategy,
  evidence: ResumeEvidence[],
  requirementMap: RequirementEvidenceMap[],
  provider: LLMProvider,
): Promise<GeneratedBullet[]> {
  const output = await provider.generateStructured<GeneratedBulletOutput>({
    system: GROUNDED_GENERATION_SYSTEM_PROMPT,
    prompt: JSON.stringify({
      profile,
      jobStrategy,
      resumeStrategy,
      evidence,
      requirementMap,
    }, null, 2),
    maxTokens: 4096,
    validate: (value): value is GeneratedBulletOutput => isGeneratedBulletOutput(value, profile, evidence, requirementMap),
  });
  if (!isGeneratedBulletOutput(output, profile, evidence, requirementMap)) {
    throw new Error("Provider returned invalid structured output");
  }

  return output.bullets.map((bullet) => ({ ...bullet, text: sanitizeBullet(bullet.text) }));
}

export function applyGeneratedBullets(profile: ResumeProfile, bullets: GeneratedBullet[]): ResumeProfile {
  const byLocation = new Map(bullets.map((bullet) => [bullet.location, bullet]));
  return {
    ...profile,
    projects: profile.projects.map((project) => ({
      ...project,
      bullets: project.bullets.map((bullet, index) =>
        byLocation.get(`project:${project.id}:${index}`)?.text || bullet
      ),
    })),
    experience: profile.experience.map((experience) => ({
      ...experience,
      bullets: experience.bullets.map((bullet, index) =>
        byLocation.get(`experience:${experience.id}:${index}`)?.text || bullet
      ),
    })),
  };
}

export function isGeneratedBulletOutput(
  value: unknown,
  profile: ResumeProfile,
  evidence: ResumeEvidence[],
  requirementMap: RequirementEvidenceMap[],
): value is GeneratedBulletOutput {
  if (!value || typeof value !== "object" || !Array.isArray((value as GeneratedBulletOutput).bullets)) return false;
  const validLocations = new Set([
    ...profile.projects.flatMap((project) => project.bullets.map((_, index) => `project:${project.id}:${index}`)),
    ...profile.experience.flatMap((experience) => experience.bullets.map((_, index) => `experience:${experience.id}:${index}`)),
  ]);
  const evidenceIds = new Set(evidence.map((item) => item.id));
  const requirements = new Set(requirementMap.map((item) => item.requirement.text));

  return (value as GeneratedBulletOutput).bullets.every((bullet) => (
    !!bullet &&
    typeof bullet.location === "string" &&
    validLocations.has(bullet.location) &&
    typeof bullet.text === "string" &&
    bullet.text.trim().length > 0 &&
    Array.isArray(bullet.evidenceIds) &&
    bullet.evidenceIds.length > 0 &&
    bullet.evidenceIds.every((id) => evidenceIds.has(id)) &&
    Array.isArray(bullet.targetRequirements) &&
    bullet.targetRequirements.length > 0 &&
    bullet.targetRequirements.every((requirement) => requirements.has(requirement)) &&
    ["preserved", "reframed", "rewritten"].includes(bullet.changeType)
  ));
}