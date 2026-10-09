import { describe, expect, it } from "vitest";
import { buildResumeEvidence } from "@/lib/tailoring/evidence";
import { evaluateTailoringOutput } from "@/lib/tailoring/evaluation";
import { mapRequirementsToEvidence } from "@/lib/tailoring/mapping";
import { planResumeStrategy } from "@/lib/tailoring/strategy";
import { verifyGeneratedBullets } from "@/lib/tailoring/verification";
import type { JobStrategy, GeneratedBullet, ResumeProfile } from "@/types";

const profile: ResumeProfile = {
  header: { name: "Candidate", phone: "555-555-5555", email: "candidate@example.com", linkedin: "linkedin.com/in/candidate", github: "github.com/candidate" },
  education: [{ school: "NJIT", location: "Newark, NJ", degree: "B.S. Computer Science", dates: "May 2026" }],
  skills: [{ category: "AI Engineering", items: ["Claude API", "Python"] }],
  projects: [{ id: "agent", title: "Agent Platform", tags: "Claude API", status: "2026", bullets: ["Built Claude API workflows across 20 responses."] }],
  experience: [{ id: "assistant", title: "Research Assistant", company: "NJIT", location: "Newark, NJ", dates: "2025", bullets: ["Improved testing using Python scripts across 500 rows."] }],
};

const jobStrategy: JobStrategy = {
  role: "Associate AI Engineer",
  coreThemes: [{ name: "Agentic AI", importance: "critical", evidence: ["AI workflows"] }],
  mustHaveRequirements: [{ text: "Claude API workflows", category: "technical", importance: "critical" }],
  preferredRequirements: [],
  responsibilities: ["Build AI products"],
  technicalPriorities: ["Claude API"],
  behavioralPriorities: [],
  keywords: ["Claude API", "Python"],
  hiringSignals: [],
  resumeImplications: [],
};

describe("Tailoring V2 benchmark", () => {
  it("scores a grounded, relevant output across the benchmark dimensions", () => {
    const evidence = buildResumeEvidence(profile);
    const requirementMap = mapRequirementsToEvidence(jobStrategy.mustHaveRequirements, evidence);
    const resumeStrategy = planResumeStrategy(jobStrategy, evidence, requirementMap);
    const generatedBullets: GeneratedBullet[] = [{
      location: "project:agent:0",
      text: "Built Claude API workflows across 20 responses.",
      evidenceIds: ["project:agent"],
      targetRequirements: ["Claude API workflows"],
      changeType: "preserved",
    }];
    const verification = verifyGeneratedBullets(generatedBullets, evidence);
    const result = evaluateTailoringOutput({
      profile,
      keywords: jobStrategy.keywords,
      jobStrategy,
      resumeStrategy,
      requirementMap,
      generatedBullets,
      verification,
    });

    expect(result.factualGrounding).toBe(100);
    expect(result.requirementCoverage).toBe(100);
    expect(result.evidenceCoverage).toBe(100);
    expect(result.latexIntegrity).toBe(100);
    expect(result.overall).toBeGreaterThan(70);
  });

  it("penalizes unsupported generated claims", () => {
    const evidence = buildResumeEvidence(profile);
    const requirementMap = mapRequirementsToEvidence(jobStrategy.mustHaveRequirements, evidence);
    const resumeStrategy = planResumeStrategy(jobStrategy, evidence, requirementMap);
    const generatedBullets: GeneratedBullet[] = [{
      location: "project:agent:0",
      text: "Built Kubernetes workflows across 50 responses.",
      evidenceIds: ["project:agent"],
      targetRequirements: ["Claude API workflows"],
      changeType: "rewritten",
    }];
    const verification = verifyGeneratedBullets(generatedBullets, evidence);
    const result = evaluateTailoringOutput({
      profile,
      keywords: jobStrategy.keywords,
      jobStrategy,
      resumeStrategy,
      requirementMap,
      generatedBullets,
      verification,
    });

    expect(result.factualGrounding).toBe(0);
    expect(result.overall).toBeLessThan(80);
  });
});