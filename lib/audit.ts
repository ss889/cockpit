import { renderResumeLatex } from "@/lib/renderLatex";
import type {
  AuditGap,
  AuditKeywordCategory,
  AuditKeywordGroups,
  AuditReport,
  AuditSuggestion,
  FormatResult,
  HonestyFlag,
  KeywordResult,
} from "@/types/audit";
import type { ResumeProfile } from "@/types/profile";

export const MAX_AUDIT_KEYWORDS = 25;

export const extractJdKeywordsTool = {
  name: "extract_jd_keywords",
  description: "Extract ATS keywords from a job description, grouped by category",
  input_schema: {
    type: "object" as const,
    properties: {
      required: {
        type: "array",
        items: { type: "string" },
        maxItems: 12,
      },
      nice_to_have: {
        type: "array",
        items: { type: "string" },
        maxItems: 8,
      },
      soft_skills: {
        type: "array",
        items: { type: "string" },
        maxItems: 5,
      },
    },
    required: ["required", "nice_to_have", "soft_skills"],
  },
};

export const assessKeywordPresenceTool = {
  name: "assess_keyword_presence",
  description: "Assess whether extracted JD keywords are present, weak, or missing in the resume text",
  input_schema: {
    type: "object" as const,
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          properties: {
            keyword: { type: "string" },
            status: {
              type: "string",
              enum: ["present", "weak", "missing"],
            },
            reason: { type: "string" },
            honesty_flag: {
              type: "string",
              enum: ["safe", "verify_first", "do_not_add"],
            },
          },
          required: ["keyword", "status", "reason", "honesty_flag"],
        },
      },
    },
    required: ["results"],
  },
};

export type KeywordPresenceToolOutput = {
  results: {
    keyword: string;
    status: "present" | "weak" | "missing";
    reason: string;
    honesty_flag: HonestyFlag;
  }[];
};

export function resumeProfileToAuditText(profile: ResumeProfile): string {
  const lines = [
    profile.header.name,
    [profile.header.phone, profile.header.email, profile.header.linkedin, profile.header.github].filter(Boolean).join(" | "),
    "",
    "Education",
    ...profile.education.flatMap((item) => [item.school, item.degree, item.dates].filter(Boolean)),
    "",
    "Skills",
    ...profile.skills.map((skill) => `${skill.category}: ${skill.items.join(", ")}`),
    "",
    "Experience",
    ...profile.experience.flatMap((item) => [
      `${item.title}, ${item.company}, ${item.dates}`,
      ...item.bullets,
    ]),
    "",
    "Projects",
    ...profile.projects.flatMap((item) => [
      `${item.title}, ${item.tags}, ${item.status}`,
      ...item.bullets,
    ]),
  ];

  return lines.filter((line) => line !== undefined).join("\n");
}

export function normalizeKeywordGroups(groups: Partial<AuditKeywordGroups>): AuditKeywordGroups {
  const required = cleanKeywords(groups.required);
  const niceToHave = cleanKeywords(groups.nice_to_have);
  const softSkills = cleanKeywords(groups.soft_skills);
  const all = [
    ...required.map((keyword) => ({ category: "required" as const, keyword })),
    ...niceToHave.map((keyword) => ({ category: "nice_to_have" as const, keyword })),
    ...softSkills.map((keyword) => ({ category: "soft_skills" as const, keyword })),
  ].slice(0, MAX_AUDIT_KEYWORDS);

  return {
    required: all.filter((item) => item.category === "required").map((item) => item.keyword),
    nice_to_have: all.filter((item) => item.category === "nice_to_have").map((item) => item.keyword),
    soft_skills: all.filter((item) => item.category === "soft_skills").map((item) => item.keyword),
  };
}

export function normalizeKeywordResults(
  groups: AuditKeywordGroups,
  output: KeywordPresenceToolOutput
): KeywordResult[] {
  const keywords = flattenKeywordGroups(groups);
  const categoryByKeyword = new Map<string, AuditKeywordCategory>();
  for (const category of ["required", "nice_to_have", "soft_skills"] as const) {
    for (const keyword of groups[category]) {
      categoryByKeyword.set(normalizeTerm(keyword), category);
    }
  }
  const outputByKeyword = new Map((output.results || []).map((item) => [normalizeTerm(item.keyword), item]));

  return keywords.map(({ keyword, category }) => {
    const item = outputByKeyword.get(normalizeTerm(keyword));

    return {
      keyword,
      category,
      status: item?.status || "missing",
      reason: cleanText(item?.reason) || "No keyword assessment returned.",
      honestyFlag: item?.honesty_flag || "verify_first",
    };
  });
}

export function calculateScore(keywords: KeywordResult[], format: FormatResult[]): number {
  const keywordTotal = keywords.length || 1;
  const keywordPoints = keywords.reduce((sum, item) => {
    if (item.status === "present") return sum + 1;
    if (item.status === "weak") return sum + 0.5;
    return sum;
  }, 0);
  const formatTotal = format.length || 1;
  const formatPoints = format.filter((item) => item.passed).length;
  const score = (keywordPoints / keywordTotal) * 0.7 + (formatPoints / formatTotal) * 0.3;

  return Math.max(0, Math.min(100, Math.round(score * 100)));
}

export function buildAuditReport(
  keywordResults: KeywordResult[],
  formatResults: FormatResult[]
): AuditReport {
  const gaps = buildGaps(keywordResults);

  return {
    generatedAt: new Date().toISOString(),
    score: calculateScore(keywordResults, formatResults),
    keywordResults,
    formatResults,
    gaps,
    suggestions: buildSuggestions(gaps),
  };
}

export function renderAuditResumeText(profile: ResumeProfile): string {
  return `${resumeProfileToAuditText(profile)}\n\nLaTeX Source\n${renderResumeLatex(profile)}`;
}

function buildGaps(keywordResults: KeywordResult[]): AuditGap[] {
  return keywordResults
    .filter((item): item is KeywordResult & { status: "weak" | "missing" } => item.status !== "present")
    .map((item) => ({
      keyword: item.keyword,
      category: item.category,
      status: item.status,
      whyItMatters: `${item.keyword} appears in the JD and is ${item.status === "weak" ? "not explicit enough" : "not represented"} in the resume.`,
      honestyFlag: item.honestyFlag,
    }));
}

function buildSuggestions(gaps: AuditGap[]): AuditSuggestion[] {
  return gaps.slice(0, 8).map((gap, index) => ({
    rank: index + 1,
    keyword: gap.keyword,
    change:
      gap.honestyFlag === "do_not_add"
        ? `Do not add ${gap.keyword} unless you can back it up in an interview.`
        : `Mention ${gap.keyword} where it is already supported by your resume evidence.`,
    location: gap.category === "soft_skills" ? "Experience or project bullet" : "Skills or most relevant project bullet",
    estimatedImpact: gap.category === "required" ? 8 : gap.category === "nice_to_have" ? 5 : 3,
    honestyFlag: gap.honestyFlag,
  }));
}

function cleanKeywords(items: string[] | undefined): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const item of items || []) {
    const clean = cleanText(item);
    const key = normalizeTerm(clean);
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    output.push(clean);
  }
  return output;
}

function flattenKeywordGroups(groups: AuditKeywordGroups): { keyword: string; category: AuditKeywordCategory }[] {
  return (["required", "nice_to_have", "soft_skills"] as const).flatMap((category) =>
    groups[category].map((keyword) => ({ keyword, category }))
  );
}

function cleanText(value: string | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function normalizeTerm(value: string): string {
  return cleanText(value).toLowerCase();
}
