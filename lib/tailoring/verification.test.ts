import { describe, expect, it } from "vitest";
import { verifyGeneratedBullets } from "@/lib/tailoring/verification";
import type { GeneratedBullet, ResumeEvidence } from "@/types/tailoring";

const evidence: ResumeEvidence[] = [{
  id: "project:agent",
  section: "project",
  sourceName: "Agent Platform",
  originalText: "Built Claude API workflows across 20 responses.",
  claims: [{ text: "Built Claude API workflows across 20 responses.", type: "technical" }],
  technologies: ["Claude", "API"],
  competencies: ["execution"],
  metrics: [{ value: "20", context: "responses", sourceText: "Built Claude API workflows across 20 responses." }],
  confidence: "verified",
}];

describe("resume verification", () => {
  it("passes a generated bullet grounded in cited evidence", () => {
    const result = verifyGeneratedBullets([{
      location: "project:agent:0",
      text: "Built Claude API workflows across 20 responses.",
      evidenceIds: ["project:agent"],
      targetRequirements: ["Claude API workflows"],
      changeType: "preserved",
    }], evidence);

    expect(result.passed).toBe(true);
    expect(result.overallRisk).toBe("low");
  });

  it("blocks altered metrics and unsupported technologies", () => {
    const bullet: GeneratedBullet = {
      location: "project:agent:0",
      text: "Built Kubernetes workflows across 50 responses.",
      evidenceIds: ["project:agent"],
      targetRequirements: ["Kubernetes workflows"],
      changeType: "rewritten",
    };
    const result = verifyGeneratedBullets([bullet], evidence);

    expect(result.passed).toBe(false);
    expect(result.alteredMetrics).toContain("project:agent:0: 50");
    expect(result.unsupportedTechnologies).toContain("Kubernetes");
    expect(result.overallRisk).toBe("high");
  });

  it("flags missing evidence links as unsupported claims", () => {
    const result = verifyGeneratedBullets([{
      location: "project:agent:0",
      text: "Led production Kubernetes operations.",
      evidenceIds: [],
      targetRequirements: ["Kubernetes operations"],
      changeType: "rewritten",
    }], evidence);

    expect(result.unsupportedClaims[0].reason).toContain("does not reference");
    expect(result.passed).toBe(false);
  });
});