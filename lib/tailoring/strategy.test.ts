import { describe, expect, it } from "vitest";
import { buildResumeEvidence } from "@/lib/tailoring/evidence";
import { mapRequirementsToEvidence } from "@/lib/tailoring/mapping";
import { planResumeStrategy } from "@/lib/tailoring/strategy";
import type { JobStrategy } from "@/types/tailoring";
import type { ResumeProfile } from "@/types/profile";

const profile: ResumeProfile = {
  header: { name: "Candidate", phone: "555-555-5555", email: "candidate@example.com", linkedin: "", github: "" },
  education: [],
  skills: [{ category: "AI Engineering", items: ["Claude API", "RAG"] }],
  projects: [
    { id: "agent", title: "Agent Platform", tags: "Claude API", status: "2026", bullets: ["Built Claude API workflows with structured tests."] },
    { id: "scraper", title: "Funding Scraper", tags: "Python", status: "2025", bullets: ["Built a Python data pipeline."] },
    { id: "portfolio", title: "Portfolio Site", tags: "HTML/CSS", status: "2024", bullets: ["Built a personal portfolio website."] },
  ],
  experience: [{ id: "assistant", title: "Research Assistant", company: "NJIT", location: "Newark", dates: "2025", bullets: ["Documented technical workflows."] }],
};

const strategy: JobStrategy = {
  role: "Associate AI Engineer",
  coreThemes: [{ name: "Agentic AI", importance: "critical", evidence: ["AI workflows"] }],
  mustHaveRequirements: [{ text: "Claude API workflows", category: "technical", importance: "critical" }],
  preferredRequirements: [{ text: "Kubernetes operations", category: "operational", importance: "high" }],
  responsibilities: [],
  technicalPriorities: ["Claude API"],
  behavioralPriorities: [],
  keywords: ["Claude API"],
  hiringSignals: [],
  resumeImplications: [],
};

describe("resume strategy planner", () => {
  it("includes the strongest supported project and de-emphasizes weaker projects", () => {
    const evidence = buildResumeEvidence(profile);
    const mappings = mapRequirementsToEvidence(strategy.mustHaveRequirements, evidence);
    const planned = planResumeStrategy(strategy, evidence, mappings);

    expect(planned.projectsToInclude).toContain("Agent Platform");
    expect(planned.projectsToDeemphasize).toContain("Funding Scraper");
    expect(planned.themesToEmphasize).toEqual(["Agentic AI"]);
  });

  it("records unsupported requirements as evidence gaps and risks", () => {
    const evidence = buildResumeEvidence(profile);
    const mappings = mapRequirementsToEvidence([...strategy.mustHaveRequirements, ...strategy.preferredRequirements], evidence);
    const planned = planResumeStrategy(strategy, evidence, mappings);

    expect(planned.evidenceGaps).toEqual(["Kubernetes operations"]);
    expect(planned.risks).toContain("Some job requirements have no verified resume evidence and must not be added as claims.");
  });
});