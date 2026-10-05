import { getLLMProvider, type LLMProvider } from "@/lib/llm";
import { tailorResumeProfile } from "@/app/api/tailor/route";
import type { ResumeProfile } from "@/types/profile";
import type {
  DeadlineExtraction,
  JobDescriptionEntry,
  JobFitAnalysis,
  JobRequirements,
  LocalWorkspace,
} from "@/types/workspace";

export type ProcessedJob = {
  requirements: JobRequirements;
  deadline: DeadlineExtraction;
  fitAnalysis: JobFitAnalysis;
  provider: string;
  model: string;
};

export async function analyzeJob(
  job: JobDescriptionEntry,
  profile: ResumeProfile | null,
  provider: LLMProvider = getLLMProvider()
): Promise<ProcessedJob> {
  const requirements = await provider.generateStructured<JobRequirements>({
    system: "Extract job requirements without inventing details. Preserve uncertainty as empty arrays or omitted optional fields.",
    prompt: job.text,
    validate: isJobRequirements,
  });
  const deadline = extractDeterministicDeadline(job.text) || await provider.generateStructured<DeadlineExtraction>({
    system: "Extract an application deadline only when the job text provides evidence. Never infer a deadline from an email or publication date. Use null and unknown when unavailable.",
    prompt: job.text,
    validate: isDeadlineExtraction,
  });
  const fitAnalysis = profile
    ? await provider.generateStructured<JobFitAnalysis>({
        system: "Compare this job against the supplied resume profile. Be advisory and grounded. Never invent experience, tools, metrics, or qualifications.",
        prompt: JSON.stringify({ job: job.text, profile }, null, 2),
        validate: isJobFitAnalysis,
      })
    : emptyFitAnalysis("No base resume profile is available for fit analysis.");

  return {
    requirements,
    deadline,
    fitAnalysis,
    provider: provider.getProviderName(),
    model: provider.getModelName(),
  };
}

export async function processWorkspaceJob(
  jobId: string,
  workspace: LocalWorkspace,
  provider: LLMProvider = getLLMProvider()
): Promise<LocalWorkspace> {
  const job = workspace.jobDescriptions.find((item) => item.id === jobId);
  if (!job) throw new Error(`Job not found: ${jobId}`);
  const processingJob = { ...job, ingestionStatus: "processing" as const, processingError: undefined };
  const startedWorkspace = replaceJob(workspace, processingJob);

  try {
    const result = await analyzeJob(processingJob, workspace.baseResumeProfile, provider);
    const tailored = workspace.baseResumeProfile
      ? await tailorResumeProfile(processingJob.text, workspace.baseResumeProfile)
      : null;
    const generatedAt = new Date().toISOString();
    const resumeVersion = tailored
      ? {
          id: `resume-${jobId}-${Date.now()}`,
          jobId,
          baseResumeVersion: String(workspace.baseResumeProfile?.header.name || "base-profile"),
          provider: "anthropic",
          model: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5",
          generatedAt,
          promptVersion: "tailor-v1",
          latex: tailored.latex,
          qaBefore: tailored.qa.before.length,
          qaAfter: tailored.qa.after.length,
        }
      : null;

    return replaceJob(startedWorkspace, {
      ...processingJob,
      requirements: result.requirements,
      deadline: result.deadline.deadline || undefined,
      deadlineTimezone: result.deadline.timezone || undefined,
      deadlineText: result.deadline.evidence || undefined,
      deadlineConfidence: result.deadline.confidence,
      deadlineEvidence: result.deadline.evidence || undefined,
      deadlineSource: result.deadline.source,
      fitAnalysis: result.fitAnalysis,
      ...(tailored && {
        tailoredLatex: tailored.latex,
        tailoredAt: generatedAt,
        status: tailored.qa.after.length === 0 ? "ready" : "error",
        error: tailored.qa.after.length === 0 ? undefined : "Resume QA has remaining issues",
        ...(resumeVersion ? { resumeVersions: [...(processingJob.resumeVersions || []), resumeVersion] } : {}),
      }),
      ingestionStatus: "ready",
      updatedAt: new Date().toISOString(),
      sourceMetadata: {
        ...(processingJob.sourceMetadata || {}),
        processingProvider: result.provider,
        processingModel: result.model,
        processedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Job processing failed";
    return replaceJob(startedWorkspace, {
      ...processingJob,
      ingestionStatus: "error",
      processingError: message,
      updatedAt: new Date().toISOString(),
    });
  }
}

export function extractDeterministicDeadline(text: string): DeadlineExtraction | null {
  const match = text.match(/\b(?:deadline|apply by|applications? close|closing date)\s*[:\-]?\s*((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:,\s*\d{4})?|\d{4}-\d{2}-\d{2})/i);
  if (!match) return null;
  const parsed = parseDate(match[1]);
  if (!parsed) return null;
  return {
    deadline: parsed,
    timezone: null,
    confidence: "high",
    evidence: match[0],
    source: "text",
  };
}

function parseDate(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function isJobRequirements(value: unknown): value is JobRequirements {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<JobRequirements>;
  return [
    candidate.requiredSkills,
    candidate.preferredSkills,
    candidate.technologies,
    candidate.responsibilities,
    candidate.qualifications,
    candidate.educationRequirements,
    candidate.experienceRequirements,
  ].every(Array.isArray);
}

function isDeadlineExtraction(value: unknown): value is DeadlineExtraction {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<DeadlineExtraction>;
  return (
    (candidate.deadline === null || typeof candidate.deadline === "string") &&
    (candidate.timezone === null || typeof candidate.timezone === "string") &&
    ["high", "medium", "low", "unknown"].includes(candidate.confidence || "") &&
    (candidate.evidence === null || typeof candidate.evidence === "string") &&
    ["structured", "text", "llm", "unknown"].includes(candidate.source || "")
  );
}

function isJobFitAnalysis(value: unknown): value is JobFitAnalysis {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<JobFitAnalysis>;
  return [
    candidate.strongMatches,
    candidate.partialMatches,
    candidate.missingRequirements,
    candidate.relevantExperience,
    candidate.resumeFocus,
    candidate.warnings,
  ].every(Array.isArray);
}

function emptyFitAnalysis(warning: string): JobFitAnalysis {
  return { strongMatches: [], partialMatches: [], missingRequirements: [], relevantExperience: [], resumeFocus: [], warnings: [warning] };
}

function replaceJob(workspace: LocalWorkspace, job: JobDescriptionEntry): LocalWorkspace {
  return {
    ...workspace,
    jobDescriptions: workspace.jobDescriptions.map((item) => item.id === job.id ? job : item),
  };
}