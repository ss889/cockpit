import type { ResumeEvidence, Requirement, RequirementEvidenceMap, EvidenceStrength, EvidenceMatch } from "@/types/tailoring";

const STOP_WORDS = new Set([
  "a", "an", "and", "for", "from", "in", "of", "on", "or", "the", "to", "with",
  "build", "building", "develop", "developing", "experience", "using", "work", "working",
]);

export function mapRequirementsToEvidence(
  requirements: Requirement[],
  evidence: ResumeEvidence[],
): RequirementEvidenceMap[] {
  return requirements.map((requirement) => {
    const requirementTerms = meaningfulTerms(requirement.text);
    const matches = evidence
      .map((item) => scoreEvidence(requirementTerms, item))
      .filter((match) => match.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 5);

    return {
      requirement,
      matches,
      recommendedEvidence: matches.slice(0, 3).map((match) => match.evidenceId),
      evidenceStrength: strengthFor(matches[0]?.score || 0),
    };
  });
}

function scoreEvidence(requirementTerms: string[], evidence: ResumeEvidence): EvidenceMatch {
  const source = [
    evidence.sourceName,
    evidence.originalText,
    ...evidence.technologies,
    ...evidence.competencies,
    ...evidence.claims.map((claim) => claim.text),
  ].join(" ");
  const evidenceTerms = new Set(meaningfulTerms(source));
  const matchedTerms = requirementTerms.filter((term) => evidenceTerms.has(term));
  const score = requirementTerms.length ? matchedTerms.length / requirementTerms.length : 0;

  return { evidenceId: evidence.id, matchedTerms, score: Number(score.toFixed(3)) };
}

function strengthFor(score: number): EvidenceStrength {
  if (score >= 0.6) return "strong";
  if (score >= 0.35) return "moderate";
  if (score > 0) return "weak";
  return "none";
}

function meaningfulTerms(value: string): string[] {
  return Array.from(new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9+#.]+/g, " ")
      .split(/\s+/)
      .map((term) => term.trim())
      .filter((term) => term.length > 2 && !STOP_WORDS.has(term)),
  ));
}