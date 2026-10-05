import { describe, expect, it } from "vitest";
import { emptyWorkspace } from "@/lib/localWorkspace";
import { LinkedInSavedJobsAdapter, getSavedJobsAdapter, syncSavedJobReferences } from "@/lib/savedJobs";

describe("saved-job adapters", () => {
  it("extracts LinkedIn job references from a saved-jobs capture", () => {
    const adapter = new LinkedInSavedJobsAdapter();
    const references = adapter.extractSavedJobs({
      url: "https://www.linkedin.com/my-items/saved-jobs/",
      visibleText: "Software Engineer\nhttps://www.linkedin.com/jobs/view/12345?utm_source=saved\nOther text",
      capturedAt: "2026-09-29T12:00:00.000Z",
    });

    expect(references).toEqual([
      {
        externalId: "12345",
        source: "linkedin",
        url: "https://www.linkedin.com/jobs/view/12345",
        title: "Software Engineer",
        capturedAt: "2026-09-29T12:00:00.000Z",
      },
    ]);
  });

  it("imports saved references as reviewable jobs and deduplicates repeats", () => {
    const reference = {
      externalId: "12345",
      source: "linkedin",
      url: "https://www.linkedin.com/jobs/view/12345",
      title: "Software Engineer",
      capturedAt: "2026-09-29T12:00:00.000Z",
    };
    const first = syncSavedJobReferences([reference], emptyWorkspace());
    const second = syncSavedJobReferences([reference], first.workspace);

    expect(first.imported).toBe(1);
    expect(first.workspace.jobDescriptions[0].sourceType).toBe("saved_jobs");
    expect(first.workspace.jobDescriptions[0].ingestionStatus).toBe("needs_review");
    expect(second.imported).toBe(0);
    expect(second.duplicates).toBe(1);
  });

  it("uses title text that appears after the LinkedIn job URL in the capture", () => {
    const adapter = new LinkedInSavedJobsAdapter();
    const references = adapter.extractSavedJobs({
      url: "https://www.linkedin.com/my-items/saved-jobs/",
      visibleText: "https://www.linkedin.com/jobs/view/12345?utm_source=saved\nStaff Product Engineer",
      capturedAt: "2026-09-29T12:00:00.000Z",
    });

    expect(references).toEqual([
      {
        externalId: "12345",
        source: "linkedin",
        url: "https://www.linkedin.com/jobs/view/12345",
        title: "Staff Product Engineer",
        capturedAt: "2026-09-29T12:00:00.000Z",
      },
    ]);
  });

  it("uses a generic browser adapter for non-LinkedIn job pages", () => {
    const adapter = getSavedJobsAdapter("https://jobs.example.com/positions");
    expect(adapter).not.toBeNull();

    const references = adapter!.extractSavedJobs({
      url: "https://jobs.example.com/positions",
      visibleText: "Senior Platform Engineer\nhttps://jobs.example.com/positions/98765\nApply now",
      capturedAt: "2026-09-29T12:00:00.000Z",
    });

    expect(references).toEqual([
      {
        externalId: "98765",
        source: "jobs.example.com",
        url: "https://jobs.example.com/positions/98765",
        title: "Senior Platform Engineer",
        capturedAt: "2026-09-29T12:00:00.000Z",
      },
    ]);
  });

  it("extracts a title when the URL and title are on the same line", () => {
    const adapter = new LinkedInSavedJobsAdapter();
    const references = adapter.extractSavedJobs({
      url: "https://www.linkedin.com/my-items/saved-jobs/",
      visibleText: "Staff Product Engineer - https://www.linkedin.com/jobs/view/98765?utm_source=saved",
      capturedAt: "2026-09-29T12:00:00.000Z",
    });

    expect(references).toEqual([
      {
        externalId: "98765",
        source: "linkedin",
        url: "https://www.linkedin.com/jobs/view/98765",
        title: "Staff Product Engineer",
        capturedAt: "2026-09-29T12:00:00.000Z",
      },
    ]);
  });
});