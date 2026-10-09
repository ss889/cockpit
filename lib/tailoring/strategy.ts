import type { ResumeEvidence, ResumeStrategy, JobStrategy, RequirementEvidenceMap } from "@/types/tailoring";

const PROJECT_BUDGET = 2;

export function planResumeStrategy(
  jobStrategy: JobStrategy,
  evidence: ResumeEvidence[],
  requirementMap: RequirementEvidenceMap[],
): ResumeStrategy {
  const projectEvidence = evidence.filter((item) => item.section === "project");
  const experienceEvidence = evidence.filter((item) => item.section === "experience");
  const recommendedIds = requirementMap
    .filter((item) => item.evidenceStrength === "strong" || item.evidenceStrength === "moderate")
    .flatMap((item) => item.recommendedEvidence);
  const projectScores = scoreEvidenceIds(projectEvidence, recommendedIds);
  const projectsToInclude = projectScores
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, PROJECT_BUDGET)
    .map((item) => item.sourceName);
  const includedProjectNames = new Set(projectsToInclude);
  const projectsToDeemphasize = projectEvidence
    .filter((item) => !includedProjectNames.has(item.sourceName))
    .sort((left, right) => scoreFor(projectScores, right.id) - scoreFor(projectScores, left.id))
    .map((item) => item.sourceName);
  const experiencesToEmphasize = experienceEvidence
    .filter((item) => recommendedIds.includes(item.id))
    .map((item) => item.sourceName);
  const experiencesToDeemphasize = experienceEvidence
    .filter((item) => !experiencesToEmphasize.includes(item.sourceName))
    .map((item) => item.sourceName);
  const evidenceGaps = requirementMap
    .filter((item) => item.evidenceStrength === "none")
    .map((item) => item.requirement.text);

  return {
    targetRole: jobStrategy.role,
    themesToEmphasize: jobStrategy.coreThemes
      .filter((theme) => theme.importance === "critical" || theme.importance === "high")
      .map((theme) => theme.name),
    projectsToInclude,
    projectsToRemove: [],
    projectsToDeemphasize,
    experiencesToEmphasize,
    experiencesToDeemphasize,
    bulletPriorities: buildBulletPriorities(requirementMap),
    skillsToPrioritize: prioritizeSkills(jobStrategy, evidence),
    evidenceGaps,
    risks: buildRisks(requirementMap, projectsToDeemphasize.length),
  };
}

function scoreEvidenceIds(evidence: ResumeEvidence[], recommendedIds: string[]): { sourceName: string; score: number }[] {
  return evidence.map((item) => ({
    sourceName: item.sourceName,
    score: recommendedIds.filter((id) => id === item.id).length,
  }));
}

function scoreFor(scores: { sourceName: string; score: number }[], id: string): number {
  return scores.find((item) => item.sourceName === id)?.score || 0;
}

function buildBulletPriorities(requirementMap: RequirementEvidenceMap[]): Record<string, string[]> {
  const priorities: Record<string, string[]> = {};
  for (const mapping of requirementMap) {
    for (const evidenceId of mapping.recommendedEvidence) {
      priorities[evidenceId] = [...(priorities[evidenceId] || []), mapping.requirement.text];
    }
  }
  return priorities;
}

function prioritizeSkills(jobStrategy: JobStrategy, evidence: ResumeEvidence[]): string[] {
  const technicalTerms = new Set(jobStrategy.technicalPriorities.map(normalize));
  return unique(
    evidence
      .filter((item) => item.section === "skills" || item.section === "project")
      .flatMap((item) => item.technologies)
      .sort((left, right) => Number(technicalTerms.has(normalize(right))) - Number(technicalTerms.has(normalize(left)))),
  );
}

function buildRisks(requirementMap: RequirementEvidenceMap[], deEmphasizedProjects: number): string[] {
  const risks: string[] = [];
  if (requirementMap.some((item) => item.evidenceStrength === "none")) {
    risks.push("Some job requirements have no verified resume evidence and must not be added as claims.");
  }
  if (deEmphasizedProjects > 0) risks.push("Less relevant projects may be reduced to preserve resume space.");
  return risks;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
}