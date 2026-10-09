import { describe, expect, it } from "vitest";
import { buildResumeEvidence } from "@/lib/tailoring/evidence";
import { mapRequirementsToEvidence } from "@/lib/tailoring/mapping";
import type { ResumeProfile } from "@/types/profile";
import type { Requirement } from "@/types/tailoring";

const profile: ResumeProfile = {
  header: { name: "Candidate", phone: "555-555-5555", email: "candidate@example.com", linkedin: "", github: "" },
  education: [],
  skills: [{ category: "AI Engineering", items: ["Claude API", "Agentic Workflows", "RAG"] }],
  projects: [{
    id: "jobops-ai",
    title: "JobOps AI",
    tags: "Next.js, TypeScript, Claude API",
    status: "2026",
    bullets: ["Built multi-step Claude API workflows with structured outputs and deterministic tests."],
  }],
  experience: [{
    id: "assistant",
    title: "Research Assistant",
    company: "NJIT",
    location: "Newark, NJ",
    dates: "2025",
    bullets: ["Documented technical workflows for team members."],
  }],
};

describe("requirement evidence mapping", () => {
  it("recommends matching verified evidence for a supported requirement", () => {
    const requirements: Requirement[] = [{
      text: "Experience building Claude API workflows",
      category: "technical",
      importance: "critical",
    }];
    const result = mapRequirementsToEvidence(requirements, buildResumeEvidence(profile))[0];

    expect(result.evidenceStrength).toBe("strong");
    expect(result.recommendedEvidence[0]).toBe("project:jobops-ai");
    expect(result.recommendedEvidence).toContain("skills:skills:0:claude-api");
    expect(result.matches[0].matchedTerms).toContain("claude");
  });

  it("marks unsupported requirements as having no evidence", () => {
    const requirements: Requirement[] = [{
      text: "Kubernetes production operations",
      category: "operational",
      importance: "critical",
    }];
    const result = mapRequirementsToEvidence(requirements, buildResumeEvidence(profile))[0];

    expect(result.evidenceStrength).toBe("none");
    expect(result.recommendedEvidence).toEqual([]);
  });

  it("keeps evidence matches linked to source inventory IDs", () => {
    const requirements: Requirement[] = [{
      text: "Technical documentation",
      category: "behavioral",
      importance: "medium",
    }];
    const evidenceIds = new Set(buildResumeEvidence(profile).map((item) => item.id));
    const result = mapRequirementsToEvidence(requirements, buildResumeEvidence(profile))[0];

    expect(result.matches.every((match) => evidenceIds.has(match.evidenceId))).toBe(true);
  });
});