import { renderResumeLatex } from "@/lib/renderLatex";
import { runFormatChecks } from "@/lib/audit-format";
import { runQA } from "@/lib/resumeQA";
import type { ResumeProfile } from "@/types/profile";
import type {
  GeneratedBullet,
  JobStrategy,
  RequirementEvidenceMap,
  ResumeStrategy,
  ResumeVerification,
  TailoringEvaluation,
} from "@/types/tailoring";

export function evaluateTailoringOutput(input: {
  profile: ResumeProfile;
  keywords: string[];
  jobStrategy: JobStrategy;
  resumeStrategy: ResumeStrategy;
  requirementMap: RequirementEvidenceMap[];
  generatedBullets: GeneratedBullet[];
  verification: ResumeVerification;
}): TailoringEvaluation {
  const strategicRelevance = ratio(
    input.resumeStrategy.themesToEmphasize,
    input.jobStrategy.coreThemes
      .filter((theme) => theme.importance === "critical" || theme.importance === "high")
      .map((theme) => theme.name),
  );
  const requirementCoverage = ratio(
    input.requirementMap.filter((item) => item.evidenceStrength !== "none"),
    input.requirementMap,
  );
  const evidenceCoverage = ratio(
    input.generatedBullets.filter((bullet) => bullet.evidenceIds.length > 0),
    input.generatedBullets,
  );
  const factualGrounding = input.verification.passed ? 100 : 0;
  const qaIssues = runQA(input.profile, input.keywords);
  const readability = input.profile.projects.length + input.profile.experience.length > 0
    ? Math.max(0, Math.round(100 - (qaIssues.length / countBullets(input.profile)) * 100))
    : 100;
  const formatChecks = runFormatChecks(renderResumeText(input.profile));
  const atsAlignment = percent(formatChecks.filter((item) => item.passed).length, formatChecks.length);
  const latex = renderResumeLatex(input.profile);
  const latexIntegrity = latex.includes("\\begin{document}") && latex.includes("\\end{document}") && !latex.includes("undefined") ? 100 : 0;
  const overall = Math.round(
    strategicRelevance * 0.2 +
    requirementCoverage * 0.2 +
    evidenceCoverage * 0.2 +
    factualGrounding * 0.2 +
    readability * 0.1 +
    atsAlignment * 0.05 +
    latexIntegrity * 0.05,
  );

  return {
    strategicRelevance,
    requirementCoverage,
    evidenceCoverage,
    factualGrounding,
    readability,
    atsAlignment,
    latexIntegrity,
    overall,
  };
}

function renderResumeText(profile: ResumeProfile): string {
  return [
    profile.header.name,
    profile.header.phone,
    profile.header.email,
    ...profile.education.flatMap((item) => [item.school, item.degree, item.dates]),
    ...profile.skills.flatMap((item) => [item.category, ...item.items]),
    ...profile.projects.flatMap((item) => [item.title, item.tags, item.status, ...item.bullets]),
    ...profile.experience.flatMap((item) => [item.title, item.company, item.location, item.dates, ...item.bullets]),
  ].filter(Boolean).join("\n");
}

function countBullets(profile: ResumeProfile): number {
  return [...profile.projects, ...profile.experience].reduce((total, entry) => total + entry.bullets.length, 0) || 1;
}

function ratio<T>(matching: T[], total: T[]): number {
  return percent(matching.length, total.length);
}

function percent(value: number, total: number): number {
  return total === 0 ? 100 : Math.round((value / total) * 100);
}