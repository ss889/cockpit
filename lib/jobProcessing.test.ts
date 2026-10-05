import { describe, expect, it } from "vitest";
import { analyzeJob, extractDeterministicDeadline, processWorkspaceJob } from "@/lib/jobProcessing";
import type { LLMProvider } from "@/lib/llm";
import { emptyWorkspace } from "@/lib/localWorkspace";
import type { JobDescriptionEntry, JobRequirements, JobFitAnalysis, DeadlineExtraction } from "@/types/workspace";

const requirements: JobRequirements = {
  requiredSkills: ["TypeScript"],
  preferredSkills: [],
  technologies: ["Next.js"],
  responsibilities: ["Build services"],
  qualifications: [],
  educationRequirements: [],
  experienceRequirements: [],
};
const fit: JobFitAnalysis = {
  strongMatches: ["TypeScript"],
  partialMatches: [],
  missingRequirements: [],
  relevantExperience: ["JobOps AI"],
  resumeFocus: ["TypeScript services"],
  warnings: [],
};

const provider: LLMProvider = {
  generateText: async () => "",
  generateStructured: async <T>({ validate }: { validate: (value: unknown) => value is T }) => {
    const value = requirements.requiredSkills[0] === "TypeScript" ? requirements : fit;
    if (!validate(value)) throw new Error("unexpected test schema");
    return value;
  },
  getProviderName: () => "test",
  getModelName: () => "test-model",
  healthCheck: async () => ({ healthy: true, provider: "test", model: "test-model" }),
};

const job: JobDescriptionEntry = {
  id: "job-1",
  title: "AI Engineer",
  company: "Example Co",
  text: "AI Engineer. Deadline: October 15, 2026. Build TypeScript services.",
  createdAt: "2026-09-28T12:00:00.000Z",
  status: "saved",
  ingestionStatus: "pending",
};

describe("structured job processing", () => {
  it("extracts a supported deadline deterministically", () => {
    expect(extractDeterministicDeadline(job.text)).toEqual<DeadlineExtraction>({
      deadline: "2026-10-15",
      timezone: null,
      confidence: "high",
      evidence: "Deadline: October 15, 2026",
      source: "text",
    });
  });

  it("persists requirements, fit, and ready state", async () => {
    const workspace = { ...emptyWorkspace(), jobDescriptions: [job], baseResumeProfile: null };
    const analyzed = await analyzeJob(job, null, {
      ...provider,
      generateStructured: async <T>({ validate }: { validate: (value: unknown) => value is T }) => {
        const value = requirements;
        if (!validate(value)) throw new Error("unexpected test schema");
        return value;
      },
    });
    expect(analyzed.deadline.deadline).toBe("2026-10-15");

    const processed = await processWorkspaceJob(job.id, workspace, {
      ...provider,
      generateStructured: async <T>({ validate }: { validate: (value: unknown) => value is T }) => {
        const value = requirements;
        if (!validate(value)) throw new Error("unexpected test schema");
        return value;
      },
    });
    expect(processed.jobDescriptions[0].ingestionStatus).toBe("ready");
    expect(processed.jobDescriptions[0].requirements?.requiredSkills).toEqual(["TypeScript"]);
  });
});