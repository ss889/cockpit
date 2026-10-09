import { describe, expect, it } from "vitest";
import { applyGeneratedBullets, generateGroundedBullets } from "@/lib/tailoring/generation";
import type { LLMProvider } from "@/lib/llm";
import type { ResumeProfile } from "@/types/profile";
import type { JobStrategy, RequirementEvidenceMap, ResumeEvidence, ResumeStrategy } from "@/types/tailoring";

const profile: ResumeProfile = {
  header: { name: "Candidate", phone: "555-555-5555", email: "candidate@example.com", linkedin: "", github: "" },
  education: [],
  skills: [{ category: "AI", items: ["Claude API"] }],
  projects: [{ id: "agent", title: "Agent Platform", tags: "Claude API", status: "2026", bullets: ["Built Claude workflows."] }],
  experience: [],
};

const evidence: ResumeEvidence[] = [{
  id: "project:agent",
  section: "project",
  sourceName: "Agent Platform",
  originalText: "Built Claude workflows.",
  claims: [{ text: "Built Claude workflows.", type: "technical" }],
  technologies: ["Claude", "API"],
  competencies: ["execution"],
  metrics: [],
  confidence: "verified",
}];

const requirementMap: RequirementEvidenceMap[] = [{
  requirement: { text: "Claude API workflows", category: "technical", importance: "critical" },
  matches: [{ evidenceId: "project:agent", matchedTerms: ["claude", "api", "workflows"], score: 1 }],
  recommendedEvidence: ["project:agent"],
  evidenceStrength: "strong",
}];

const jobStrategy: JobStrategy = {
  role: "AI Engineer",
  coreThemes: [],
  mustHaveRequirements: [requirementMap[0].requirement],
  preferredRequirements: [],
  responsibilities: [],
  technicalPriorities: ["Claude API"],
  behavioralPriorities: [],
  keywords: ["Claude API"],
  hiringSignals: [],
  resumeImplications: [],
};

const resumeStrategy: ResumeStrategy = {
  targetRole: "AI Engineer",
  themesToEmphasize: ["Claude API"],
  projectsToInclude: ["Agent Platform"],
  projectsToRemove: [],
  projectsToDeemphasize: [],
  experiencesToEmphasize: [],
  experiencesToDeemphasize: [],
  bulletPriorities: { "project:agent": ["Claude API workflows"] },
  skillsToPrioritize: ["Claude API"],
  evidenceGaps: [],
  risks: [],
};

function fakeProvider(output: unknown): LLMProvider {
  return {
    generateText: async () => "",
    generateStructured: async () => output,
    getProviderName: () => "test",
    getModelName: () => "test-model",
    healthCheck: async () => ({ healthy: true, provider: "test", model: "test-model" }),
  };
}

describe("grounded bullet generation", () => {
  it("accepts only bullets linked to known evidence and requirements", async () => {
    const bullets = await generateGroundedBullets(
      profile,
      jobStrategy,
      resumeStrategy,
      evidence,
      requirementMap,
      fakeProvider({ bullets: [{
        location: "project:agent:0",
        text: "Built Claude API workflows for structured resume analysis.",
        evidenceIds: ["project:agent"],
        targetRequirements: ["Claude API workflows"],
        changeType: "reframed",
      }] }),
    );

    expect(bullets[0].evidenceIds).toEqual(["project:agent"]);
    expect(applyGeneratedBullets(profile, bullets).projects[0].bullets[0]).toContain("Claude API");
  });

  it("rejects generated bullets with unknown evidence IDs", async () => {
    await expect(generateGroundedBullets(
      profile,
      jobStrategy,
      resumeStrategy,
      evidence,
      requirementMap,
      fakeProvider({ bullets: [{
        location: "project:agent:0",
        text: "Built Kubernetes systems.",
        evidenceIds: ["project:missing"],
        targetRequirements: ["Claude API workflows"],
        changeType: "rewritten",
      }] }),
    )).rejects.toThrow("invalid structured output");
  });
});