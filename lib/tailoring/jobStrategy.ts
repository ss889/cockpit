import type {
  JobStrategy,
  Requirement,
  RequirementCategory,
  ResumeImplication,
  ResumeImplicationType,
  StrategyImportance,
  StrategyTheme,
} from "@/types/tailoring";

const IMPORTANCE_VALUES: StrategyImportance[] = ["critical", "high", "medium", "low"];
const REQUIREMENT_CATEGORIES: RequirementCategory[] = ["technical", "experience", "education", "behavioral", "operational"];
const IMPLICATION_TYPES: ResumeImplicationType[] = ["emphasize", "deemphasize", "include", "remove", "reframe"];

export const JOB_STRATEGY_SYSTEM_PROMPT = `You are analyzing a job description before any resume generation.

Your only responsibility is to identify what the employer values and what that implies for resume strategy. Do not write resume bullets. Do not evaluate or invent candidate experience. Do not recommend technologies that are not present in the job description.

Return only JSON matching the requested schema. Use empty arrays when the job description does not provide evidence. Rank importance as critical, high, medium, or low. Keep each item concise and grounded in the job description.

Schema:
{
  "role": "string",
  "company": "string or omit when unknown",
  "coreThemes": [{ "name": "string", "importance": "critical|high|medium|low", "evidence": ["quoted or closely grounded JD evidence"] }],
  "mustHaveRequirements": [{ "text": "string", "category": "technical|experience|education|behavioral|operational", "importance": "critical|high|medium|low" }],
  "preferredRequirements": [{ "text": "string", "category": "technical|experience|education|behavioral|operational", "importance": "critical|high|medium|low" }],
  "responsibilities": ["string"],
  "technicalPriorities": ["string"],
  "behavioralPriorities": ["string"],
  "keywords": ["string"],
  "hiringSignals": ["string"],
  "resumeImplications": [{ "implication": "emphasize|deemphasize|include|remove|reframe", "target": "string", "reason": "string" }]
}`;

export function isJobStrategy(value: unknown): value is JobStrategy {
  if (!value || typeof value !== "object") return false;
  const strategy = value as Partial<JobStrategy>;
  return (
    typeof strategy.role === "string" &&
    Array.isArray(strategy.coreThemes) &&
    Array.isArray(strategy.mustHaveRequirements) &&
    Array.isArray(strategy.preferredRequirements) &&
    Array.isArray(strategy.responsibilities) &&
    Array.isArray(strategy.technicalPriorities) &&
    Array.isArray(strategy.behavioralPriorities) &&
    Array.isArray(strategy.keywords) &&
    Array.isArray(strategy.hiringSignals) &&
    Array.isArray(strategy.resumeImplications)
  );
}

export function normalizeJobStrategy(value: unknown): JobStrategy {
  if (!value || typeof value !== "object") throw new Error("Invalid job strategy");
  const raw = value as Partial<JobStrategy>;
  const role = cleanString(raw.role);
  if (!role) throw new Error("Job strategy role is required");

  return {
    role,
    ...(cleanString(raw.company) ? { company: cleanString(raw.company) } : {}),
    coreThemes: normalizeThemes(raw.coreThemes),
    mustHaveRequirements: normalizeRequirements(raw.mustHaveRequirements),
    preferredRequirements: normalizeRequirements(raw.preferredRequirements),
    responsibilities: normalizeStrings(raw.responsibilities),
    technicalPriorities: normalizeStrings(raw.technicalPriorities),
    behavioralPriorities: normalizeStrings(raw.behavioralPriorities),
    keywords: normalizeStrings(raw.keywords),
    hiringSignals: normalizeStrings(raw.hiringSignals),
    resumeImplications: normalizeImplications(raw.resumeImplications),
  };
}

function normalizeThemes(value: unknown): StrategyTheme[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const theme = item as Partial<StrategyTheme>;
    const name = cleanString(theme.name);
    if (!name) return [];
    return [{
      name,
      importance: normalizeEnum(theme.importance, IMPORTANCE_VALUES, "medium"),
      evidence: normalizeStrings(theme.evidence),
    }];
  });
}

function normalizeRequirements(value: unknown): Requirement[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const requirement = item as Partial<Requirement>;
    const text = cleanString(requirement.text);
    if (!text) return [];
    return [{
      text,
      category: normalizeEnum(requirement.category, REQUIREMENT_CATEGORIES, "experience"),
      importance: normalizeEnum(requirement.importance, IMPORTANCE_VALUES, "medium"),
    }];
  });
}

function normalizeImplications(value: unknown): ResumeImplication[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const implication = item as Partial<ResumeImplication>;
    const target = cleanString(implication.target);
    const reason = cleanString(implication.reason);
    if (!target || !reason) return [];
    return [{
      implication: normalizeEnum(implication.implication, IMPLICATION_TYPES, "reframe"),
      target,
      reason,
    }];
  });
}

function normalizeStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((item) => {
    const clean = cleanString(item);
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) return [];
    seen.add(key);
    return [clean];
  });
}

function normalizeEnum<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? value as T : fallback;
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}