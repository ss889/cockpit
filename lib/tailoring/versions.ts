import type { JobDescriptionEntry, TailoredResumeVersion } from "@/types/workspace";

export function createTailoredResumeVersion(input: {
  job: JobDescriptionEntry;
  latex: string;
  provider: string;
  model: string;
  qaBefore: number;
  qaAfter: number;
  strategyVersion?: string;
  verificationStatus?: TailoredResumeVersion["verificationStatus"];
}): TailoredResumeVersion {
  return {
    id: `resume-${input.job.id}-${Date.now()}`,
    jobId: input.job.id,
    baseResumeVersion: input.job.updatedAt || "base-profile",
    provider: input.provider,
    model: input.model,
    generatedAt: new Date().toISOString(),
    promptVersion: input.strategyVersion ? "tailor-v2" : "tailor-v1",
    latex: input.latex,
    qaBefore: input.qaBefore,
    qaAfter: input.qaAfter,
    strategyVersion: input.strategyVersion,
    verificationStatus: input.verificationStatus || "not_run",
    pdfStatus: "not_run",
  };
}

export function appendTailoredResumeVersion(
  job: JobDescriptionEntry,
  version: TailoredResumeVersion,
): JobDescriptionEntry {
  return {
    ...job,
    resumeVersions: [...(job.resumeVersions || []), version],
  };
}