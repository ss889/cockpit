import { describe, expect, it } from "vitest";
import { emptyWorkspace, normalizeLocalWorkspace } from "@/lib/localWorkspace";
import { ingestPageCapture, normalizePageUrl, validatePageCapture } from "@/lib/localIngestion";

const payload = {
  url: "https://jobs.example.com/roles/42#description",
  title: "Role page",
  pageTitle: "Software Engineer - Example Co",
  visibleText: "Software Engineer\nCompany: Example Co\nBuild TypeScript services.",
  sourceHost: "jobs.example.com",
  capturedAt: "2026-09-28T12:00:00.000Z",
};

describe("local page ingestion", () => {
  it("normalizes URL identity without the fragment or default port", () => {
    expect(normalizePageUrl("HTTPS://JOBS.EXAMPLE.COM:443/roles/42/?utm_source=extension#description")).toBe(
      "https://jobs.example.com/roles/42"
    );
  });

  it("creates a job and preserves the raw capture", () => {
    const result = ingestPageCapture(validatePageCapture(payload), emptyWorkspace(), new Date(payload.capturedAt));

    expect(result.action).toBe("created");
    expect(result.job.sourceType).toBe("extension");
    expect(result.job.applicationStatus).toBe("saved");
    expect(result.job.ingestionStatus).toBe("pending");
    expect(result.job.canonicalUrl).toBe("https://jobs.example.com/roles/42");
    expect(result.workspace.jobDescriptions).toHaveLength(1);
    expect(result.workspace.sourceCaptures).toHaveLength(1);
    expect(result.workspace.sourceCaptures?.[0].visibleText).toContain("TypeScript");
  });

  it("returns the existing job for a repeated capture", () => {
    const first = ingestPageCapture(validatePageCapture(payload), emptyWorkspace(), new Date(payload.capturedAt));
    const second = ingestPageCapture(
      validatePageCapture({ ...payload, url: "https://jobs.example.com:443/roles/42#new" }),
      first.workspace,
      new Date("2026-09-28T12:05:00.000Z")
    );

    expect(second.action).toBe("duplicate");
    expect(second.job.id).toBe(first.job.id);
    expect(second.workspace.jobDescriptions).toHaveLength(1);
    expect(second.workspace.sourceCaptures).toHaveLength(2);
  });

  it("deduplicates by source external ID before URL", () => {
    const first = ingestPageCapture(
      validatePageCapture({ ...payload, url: "https://jobs.example.com/roles/43", externalId: "role-43" }),
      emptyWorkspace(),
      new Date(payload.capturedAt)
    );
    const second = ingestPageCapture(
      validatePageCapture({ ...payload, url: "https://jobs.example.com/roles/44", externalId: "role-43" }),
      first.workspace,
      new Date("2026-09-28T12:05:00.000Z")
    );

    expect(second.action).toBe("duplicate");
    expect(second.deduplicationReason).toBe("external_id");
    expect(second.job.id).toBe(first.job.id);
  });

  it("marks same-company, highly similar text for review instead of merging silently", () => {
    const first = ingestPageCapture(
      validatePageCapture({
        ...payload,
        pageTitle: "Software Engineer - Example Co",
        visibleText: "Software Engineer\nCompany: Example Co\nBuild TypeScript services and APIs. Collaborate with product teams to design reliable platform workflows, review code, improve testing, document systems, and support production releases.",
      }),
      emptyWorkspace(),
      new Date(payload.capturedAt)
    );
    const second = ingestPageCapture(
      validatePageCapture({
        ...payload,
        url: "https://other-board.example/role/99",
        sourceHost: "other-board.example",
        pageTitle: "Platform Engineer - Example Co",
        visibleText: "Platform Engineer\nCompany: Example Co\nBuild TypeScript services and APIs for users. Collaborate with product teams to design reliable platform workflows, review code, improve testing, document systems, and support production releases.",
      }),
      first.workspace,
      new Date("2026-09-28T12:05:00.000Z")
    );

    expect(second.action).toBe("needs_review");
    expect(second.job.ingestionStatus).toBe("needs_review");
    expect(second.job.duplicateOf).toBe(first.job.id);
    expect(second.workspace.jobDescriptions).toHaveLength(2);
  });

  it("rejects captures whose source host or text is invalid", () => {
    expect(() => validatePageCapture({ ...payload, sourceHost: "other.example.com" })).toThrow(
      "sourceHost must match"
    );
    expect(() => validatePageCapture({ ...payload, visibleText: "   " })).toThrow("visibleText is required");
  });

  it("loads legacy workspace records with an empty capture collection", () => {
    const workspace = normalizeLocalWorkspace({
      session: null,
      memories: [],
      jobDescriptions: [],
      baseResumeProfile: null,
      updatedAt: null,
    });

    expect(workspace.sourceCaptures).toEqual([]);
  });
});