import type { ResumeProfile } from "@/types/profile";
import type {
  EvidenceClaimType,
  EvidenceMetric,
  ResumeEvidence,
} from "@/types/tailoring";

const METRIC_PATTERN = /\b\d+(?:\.\d+)?(?:%|\+|x)?\b|\b(?:daily|weekly|monthly|annual)\b/gi;
const TECHNICAL_PATTERN = /\b(?:API|APIs|AI|Claude|Docker|FastAPI|GitHub Actions|Git|JavaScript|LaTeX|LangChain|MCP|Next\.js|OpenAI|Python|RAG|React|SQLite|TypeScript|Vitest|pytest)\b/gi;
const PROCESS_PATTERN = /\b(?:built|created|developed|deployed|designed|implemented|integrated|maintained|refactored|tested|validated|wrote|automated|configured|documented|coordinated|managed|improved|reduced|increased|replaced|shipped|cleaned)\b/i;
const RESULT_PATTERN = /\b(?:increased|improved|reduced|saved|eliminated|replaced|delivered|shipped|validated|passed|covered)\b/i;
const SCOPE_PATTERN = /\b(?:users?|records?|rows?|files?|tables?|views?|dashboards?|reports?|tests?|pipelines?|workflows?|datasets?|responses?|requests?|interactions?|teams?|projects?)\b/i;

export function buildResumeEvidence(profile: ResumeProfile): ResumeEvidence[] {
  return [
    ...profile.projects.map((project) => buildEntry("project", project.id, project.title, project.bullets, project.tags)),
    ...profile.experience.map((experience) => buildEntry("experience", experience.id, `${experience.title} at ${experience.company}`, experience.bullets)),
    ...profile.education.map((education, index) => buildEntry(
      "education",
      `education:${index}`,
      education.school,
      [`${education.degree} (${education.dates})`],
    )),
    ...profile.skills.flatMap((skill, index) => skill.items.map((item) => buildEntry(
      "skills",
      `skills:${index}:${slugify(item)}`,
      skill.category,
      [item],
      item,
    ))),
  ];
}

function buildEntry(
  section: ResumeEvidence["section"],
  id: string,
  sourceName: string,
  sourceLines: string[],
  technologyContext = "",
): ResumeEvidence {
  const originalText = sourceLines.filter(Boolean).join(" ").trim();
  const claims = sourceLines.filter(Boolean).map((text) => ({ text, type: classifyClaim(text) }));
  const metrics = sourceLines.flatMap(extractMetrics);
  const technologies = uniqueMatches(`${technologyContext} ${originalText}`, TECHNICAL_PATTERN);

  return {
    id: `${section}:${id}`,
    section,
    sourceName,
    originalText,
    claims,
    technologies,
    competencies: inferCompetencies(sourceLines),
    metrics,
    confidence: "verified",
  };
}

function classifyClaim(text: string): EvidenceClaimType {
  if (RESULT_PATTERN.test(text)) return "result";
  if (SCOPE_PATTERN.test(text)) return "scope";
  if (TECHNICAL_PATTERN.test(text)) return "technical";
  if (PROCESS_PATTERN.test(text)) return "process";
  return "responsibility";
}

function extractMetrics(text: string): EvidenceMetric[] {
  return Array.from(text.matchAll(METRIC_PATTERN), (match) => ({
    value: match[0],
    context: text,
    sourceText: text,
  }));
}

function inferCompetencies(lines: string[]): string[] {
  const competencies: string[] = [];
  const text = lines.join(" ");
  if (PROCESS_PATTERN.test(text)) competencies.push("execution");
  if (RESULT_PATTERN.test(text)) competencies.push("impact");
  if (SCOPE_PATTERN.test(text)) competencies.push("operational scope");
  if (/\b(?:team|officers|marketing|members|stakeholders|communication)\b/i.test(text)) competencies.push("communication");
  return competencies;
}

function uniqueMatches(text: string, pattern: RegExp): string[] {
  const seen = new Set<string>();
  return Array.from(text.matchAll(pattern), (match) => match[0]).filter((value) => {
    const key = value.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}