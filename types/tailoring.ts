export type StrategyImportance = "critical" | "high" | "medium" | "low";

export type RequirementCategory =
  | "technical"
  | "experience"
  | "education"
  | "behavioral"
  | "operational";

export type ResumeImplicationType = "emphasize" | "deemphasize" | "include" | "remove" | "reframe";

export type StrategyTheme = {
  name: string;
  importance: StrategyImportance;
  evidence: string[];
};

export type Requirement = {
  text: string;
  category: RequirementCategory;
  importance: StrategyImportance;
};

export type ResumeImplication = {
  implication: ResumeImplicationType;
  target: string;
  reason: string;
};

export type JobStrategy = {
  role: string;
  company?: string;
  coreThemes: StrategyTheme[];
  mustHaveRequirements: Requirement[];
  preferredRequirements: Requirement[];
  responsibilities: string[];
  technicalPriorities: string[];
  behavioralPriorities: string[];
  keywords: string[];
  hiringSignals: string[];
  resumeImplications: ResumeImplication[];
};

export type EvidenceSection = "project" | "experience" | "education" | "skills";

export type EvidenceClaimType = "responsibility" | "technical" | "result" | "scope" | "process";

export type EvidenceClaim = {
  text: string;
  type: EvidenceClaimType;
};

export type EvidenceMetric = {
  value: string;
  context: string;
  sourceText: string;
};

export type ResumeEvidence = {
  id: string;
  section: EvidenceSection;
  sourceName: string;
  originalText: string;
  claims: EvidenceClaim[];
  technologies: string[];
  competencies: string[];
  metrics: EvidenceMetric[];
  confidence: "verified";
};

export type EvidenceStrength = "strong" | "moderate" | "weak" | "none";

export type EvidenceMatch = {
  evidenceId: string;
  matchedTerms: string[];
  score: number;
};

export type RequirementEvidenceMap = {
  requirement: Requirement;
  matches: EvidenceMatch[];
  recommendedEvidence: string[];
  evidenceStrength: EvidenceStrength;
};

export type ResumeStrategy = {
  targetRole: string;
  themesToEmphasize: string[];
  projectsToInclude: string[];
  projectsToRemove: string[];
  projectsToDeemphasize: string[];
  experiencesToEmphasize: string[];
  experiencesToDeemphasize: string[];
  bulletPriorities: Record<string, string[]>;
  skillsToPrioritize: string[];
  evidenceGaps: string[];
  risks: string[];
};

export type GeneratedBulletChange = "preserved" | "reframed" | "rewritten";

export type GeneratedBullet = {
  location: string;
  text: string;
  evidenceIds: string[];
  targetRequirements: string[];
  changeType: GeneratedBulletChange;
};

export type UnsupportedClaim = {
  location: string;
  text: string;
  reason: string;
};

export type ResumeVerification = {
  passed: boolean;
  unsupportedClaims: UnsupportedClaim[];
  alteredMetrics: string[];
  unsupportedTechnologies: string[];
  unsupportedResponsibilities: string[];
  unsupportedAchievements: string[];
  warnings: string[];
  overallRisk: "low" | "medium" | "high";
};

export type TailoringEvaluation = {
  strategicRelevance: number;
  requirementCoverage: number;
  evidenceCoverage: number;
  factualGrounding: number;
  readability: number;
  atsAlignment: number;
  latexIntegrity: number;
  overall: number;
};