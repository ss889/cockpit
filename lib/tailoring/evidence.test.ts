import { describe, expect, it } from "vitest";
import { buildResumeEvidence } from "@/lib/tailoring/evidence";
import type { ResumeProfile } from "@/types/profile";

const profile: ResumeProfile = {
  header: { name: "Candidate", phone: "555-555-5555", email: "candidate@example.com", linkedin: "", github: "" },
  education: [{ school: "NJIT", location: "Newark, NJ", degree: "B.S. Computer Science", dates: "May 2026" }],
  skills: [{ category: "Languages", items: ["Python", "TypeScript"] }],
  projects: [{
    id: "jobops-ai",
    title: "JobOps AI",
    tags: "Next.js, Claude API",
    status: "2026",
    bullets: ["Built a Claude API workflow that validated 20 responses."],
  }],
  experience: [{
    id: "assistant",
    title: "Research Assistant",
    company: "NJIT",
    location: "Newark, NJ",
    dates: "2025",
    bullets: ["Improved testing using Python scripts across 500 rows."],
  }],
};

describe("resume evidence inventory", () => {
  it("preserves source sections and assigns stable evidence IDs", () => {
    const evidence = buildResumeEvidence(profile);

    expect(evidence.map((item) => item.id)).toEqual([
      "project:jobops-ai",
      "experience:assistant",
      "education:education:0",
      "skills:skills:0:python",
      "skills:skills:0:typescript",
    ]);
    expect(evidence[0].confidence).toBe("verified");
    expect(evidence[0].originalText).toContain("20 responses");
  });

  it("keeps metrics traceable to their original source text", () => {
    const evidence = buildResumeEvidence(profile);
    const projectMetric = evidence[0].metrics[0];

    expect(projectMetric.value).toBe("20");
    expect(projectMetric.sourceText).toBe(evidence[0].claims[0].text);
    expect(evidence[0].technologies).toEqual(["Next.js", "Claude", "API"]);
  });

  it("does not create evidence for data that is absent from the profile", () => {
    const evidence = buildResumeEvidence(profile);

    expect(evidence.flatMap((item) => item.metrics).map((metric) => metric.value)).not.toContain("10");
    expect(evidence.flatMap((item) => item.technologies)).not.toContain("AWS");
  });
});