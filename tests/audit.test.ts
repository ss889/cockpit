import { describe, expect, it } from "vitest";
import { calculateScore, normalizeKeywordGroups, normalizeKeywordResults } from "@/lib/audit";
import { runFormatChecks } from "@/lib/audit-format";
import type { FormatResult, KeywordResult } from "@/types/audit";

describe("ATS audit helpers", () => {
  it("calculates score with 70 percent keyword weight and 30 percent format weight", () => {
    const keywords: KeywordResult[] = [
      { keyword: "Python", category: "required", status: "present", reason: "Listed", honestyFlag: "safe" },
      { keyword: "RAG", category: "required", status: "weak", reason: "Concept present", honestyFlag: "safe" },
      { keyword: "LlamaIndex", category: "nice_to_have", status: "missing", reason: "Not listed", honestyFlag: "verify_first" },
    ];
    const format: FormatResult[] = [
      { id: "a", label: "A", passed: true, detail: "" },
      { id: "b", label: "B", passed: true, detail: "" },
      { id: "c", label: "C", passed: false, detail: "" },
    ];

    expect(calculateScore(keywords, format)).toBe(55);
  });

  it("checks standard sections, date format, and contact info", () => {
    const resumeText = [
      "Sadikul Saber",
      "555-555-5555 | sadikul@example.com",
      "",
      "Education",
      "NJIT May 2026",
      "Skills",
      "Python, TypeScript",
      "Experience",
      "Research Assistant May 2025",
      "Projects",
      "JobOps AI May 2026",
    ].join("\n");

    const checks = runFormatChecks(resumeText);
    expect(checks).toHaveLength(3);
    expect(checks.every((check) => check.passed)).toBe(true);
  });

  it("flags missing contact info and mixed date formats", () => {
    const resumeText = [
      "Sadikul Saber",
      "github.com/ss889",
      "",
      "Education",
      "NJIT May 2026",
      "Skills",
      "Python",
      "Experience",
      "Research Assistant 2025 - Present",
      "Projects",
      "JobOps AI",
    ].join("\n");

    const checks = runFormatChecks(resumeText);
    expect(checks.find((check) => check.id === "contact_info")?.passed).toBe(false);
    expect(checks.find((check) => check.id === "consistent_dates")?.passed).toBe(false);
  });

  it("normalizes keyword groups and maps presence categories", () => {
    const groups = normalizeKeywordGroups({
      required: ["Python", "Python", "RAG"],
      nice_to_have: ["LlamaIndex"],
      soft_skills: ["communication"],
    });
    const results = normalizeKeywordResults(groups, {
      results: [
        { keyword: "Python", status: "present", reason: "Listed", honesty_flag: "safe" },
        { keyword: "RAG", status: "weak", reason: "RAG pipeline listed", honesty_flag: "safe" },
        { keyword: "LlamaIndex", status: "missing", reason: "Not listed", honesty_flag: "verify_first" },
      ],
    });

    expect(groups.required).toEqual(["Python", "RAG"]);
    expect(results.map((result) => result.category)).toEqual(["required", "required", "nice_to_have", "soft_skills"]);
    expect(results.find((result) => result.keyword === "communication")?.status).toBe("missing");
  });

  it("marks omitted keyword assessments as missing", () => {
    const groups = normalizeKeywordGroups({
      required: ["Python", "RAG"],
      nice_to_have: [],
      soft_skills: [],
    });
    const results = normalizeKeywordResults(groups, {
      results: [
        { keyword: "Python", status: "present", reason: "Listed", honesty_flag: "safe" },
      ],
    });

    expect(results).toHaveLength(2);
    expect(results.find((result) => result.keyword === "RAG")?.status).toBe("missing");
  });
});
