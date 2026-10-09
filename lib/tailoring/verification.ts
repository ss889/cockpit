import type { GeneratedBullet, ResumeEvidence, ResumeVerification, UnsupportedClaim } from "@/types/tailoring";

const METRIC_PATTERN = /\b\d+(?:\.\d+)?(?:%|\+|x)?\b|\b(?:daily|weekly|monthly|annual)\b/gi;
const TECHNOLOGY_PATTERN = /\b(?:AWS|API|APIs|AI|Claude|Docker|FastAPI|GitHub Actions|Git|JavaScript|Kubernetes|LaTeX|LangChain|MCP|Next\.js|OpenAI|Python|RAG|React|SQLite|TypeScript|Vitest|pytest)\b/gi;

export function verifyGeneratedBullets(
  bullets: GeneratedBullet[],
  evidence: ResumeEvidence[],
): ResumeVerification {
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));
  const unsupportedClaims: UnsupportedClaim[] = [];
  const alteredMetrics: string[] = [];
  const unsupportedTechnologies = new Set<string>();
  const unsupportedResponsibilities: string[] = [];

  for (const bullet of bullets) {
    const sources = bullet.evidenceIds.map((id) => evidenceById.get(id)).filter(Boolean) as ResumeEvidence[];
    if (sources.length === 0) {
      unsupportedClaims.push({
        location: bullet.location,
        text: bullet.text,
        reason: "The generated bullet does not reference verified source evidence.",
      });
      continue;
    }

    const sourceText = sources.map((source) => [source.originalText, ...source.claims.map((claim) => claim.text), ...source.technologies].join(" ")).join(" ");
    const sourceMetrics = new Set(extractMatches(sourceText, METRIC_PATTERN).map(normalizeMetric));
    for (const metric of extractMatches(bullet.text, METRIC_PATTERN)) {
      if (!sourceMetrics.has(normalizeMetric(metric))) alteredMetrics.push(`${bullet.location}: ${metric}`);
    }

    const sourceTechnologies = new Set(extractMatches(sourceText, TECHNOLOGY_PATTERN).map(normalizeTerm));
    for (const technology of extractMatches(bullet.text, TECHNOLOGY_PATTERN)) {
      if (!sourceTechnologies.has(normalizeTerm(technology))) unsupportedTechnologies.add(technology);
    }

    const sourceTerms = meaningfulTerms(sourceText);
    const generatedTerms = meaningfulTerms(bullet.text);
    const overlap = generatedTerms.filter((term) => sourceTerms.includes(term));
    if (generatedTerms.length > 3 && overlap.length === 0) {
      unsupportedResponsibilities.push(bullet.location);
      unsupportedClaims.push({
        location: bullet.location,
        text: bullet.text,
        reason: "The generated wording has no meaningful term overlap with its cited evidence.",
      });
    }
  }

  const warnings: string[] = [];
  if (alteredMetrics.length > 0) warnings.push("Generated metrics must match source evidence exactly.");
  if (unsupportedTechnologies.size > 0) warnings.push("Generated technologies must appear in cited evidence.");
  if (unsupportedResponsibilities.length > 0) warnings.push("Some generated responsibilities need manual review.");
  const highRisk = unsupportedClaims.length > 0 || alteredMetrics.length > 0 || unsupportedTechnologies.size > 0;

  return {
    passed: !highRisk,
    unsupportedClaims,
    alteredMetrics,
    unsupportedTechnologies: Array.from(unsupportedTechnologies),
    unsupportedResponsibilities,
    unsupportedAchievements: [],
    warnings,
    overallRisk: highRisk ? "high" : warnings.length > 0 ? "medium" : "low",
  };
}

function extractMatches(value: string, pattern: RegExp): string[] {
  return Array.from(value.matchAll(new RegExp(pattern.source, pattern.flags)), (match) => match[0]);
}

function normalizeMetric(value: string): string {
  return value.toLowerCase();
}

function normalizeTerm(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function meaningfulTerms(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((term) => term.length > 3 && !["built", "using", "with", "from", "that", "this"].includes(term));
}