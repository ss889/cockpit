import { describe, expect, it } from "vitest";
import { appendTailoredResumeVersion, createTailoredResumeVersion } from "@/lib/tailoring/versions";
import type { JobDescriptionEntry } from "@/types/workspace";

const job: JobDescriptionEntry = {
  id: "job-1",
  title: "AI Engineer",
  company: "Example",
  text: "Build AI systems.",
  createdAt: "2026-10-07T00:00:00.000Z",
};

describe("tailored resume versions", () => {
  it("creates immutable version metadata with the generated source", () => {
    const version = createTailoredResumeVersion({
      job,
      latex: "\\documentclass{article}",
      provider: "anthropic",
      model: "claude-haiku-4-5",
      qaBefore: 4,
      qaAfter: 0,
      strategyVersion: "strategy-v1",
      verificationStatus: "passed",
    });

    expect(version.jobId).toBe("job-1");
    expect(version.latex).toContain("documentclass");
    expect(version.promptVersion).toBe("tailor-v2");
    expect(version.verificationStatus).toBe("passed");
  });

  it("appends instead of overwriting previous versions", () => {
    const first = createTailoredResumeVersion({ job, latex: "first", provider: "test", model: "test", qaBefore: 1, qaAfter: 0 });
    const second = createTailoredResumeVersion({ job, latex: "second", provider: "test", model: "test", qaBefore: 2, qaAfter: 1 });
    const updated = appendTailoredResumeVersion(appendTailoredResumeVersion(job, first), second);

    expect(updated.resumeVersions?.map((version) => version.latex)).toEqual(["first", "second"]);
    expect(job.resumeVersions).toBeUndefined();
  });
});