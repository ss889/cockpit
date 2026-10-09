import { describe, expect, it } from "vitest";
import { isJobStrategy, normalizeJobStrategy } from "@/lib/tailoring/jobStrategy";

describe("job strategy normalization", () => {
  it("normalizes valid strategy data and removes duplicate list values", () => {
    const strategy = normalizeJobStrategy({
      role: "  Associate AI Engineer  ",
      company: " Internet Brands ",
      coreThemes: [{ name: "Agentic AI", importance: "critical", evidence: ["multi-step workflows"] }],
      mustHaveRequirements: [{ text: "LLM API experience", category: "technical", importance: "high" }],
      preferredRequirements: [],
      responsibilities: ["Build AI products"],
      technicalPriorities: ["Claude API", "claude api"],
      behavioralPriorities: ["Communication"],
      keywords: ["LLM", "LLM"],
      hiringSignals: ["Ships tested software"],
      resumeImplications: [{ implication: "emphasize", target: "AI projects", reason: "Directly relevant" }],
    });

    expect(strategy.role).toBe("Associate AI Engineer");
    expect(strategy.company).toBe("Internet Brands");
    expect(strategy.technicalPriorities).toEqual(["Claude API"]);
    expect(strategy.keywords).toEqual(["LLM"]);
  });

  it("rejects a strategy without a role", () => {
    expect(() => normalizeJobStrategy({ keywords: [] })).toThrow("Job strategy role is required");
  });

  it("requires the structured strategy collections", () => {
    expect(isJobStrategy({ role: "AI Engineer" })).toBe(false);
    expect(isJobStrategy({
      role: "AI Engineer",
      coreThemes: [],
      mustHaveRequirements: [],
      preferredRequirements: [],
      responsibilities: [],
      technicalPriorities: [],
      behavioralPriorities: [],
      keywords: [],
      hiringSignals: [],
      resumeImplications: [],
    })).toBe(true);
  });
});