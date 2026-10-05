import { describe, expect, it } from "vitest";
import { buildCapture, getIngestUrl } from "./shared.js";

describe("JobOps extension helpers", () => {
  it("builds the bounded page capture contract", () => {
    const capture = buildCapture(
      { url: "https://jobs.example.com/role#details", title: "Software Engineer" },
      "  Visible job text  ",
      "2026-09-28T12:00:00.000Z"
    );

    expect(capture).toEqual({
      url: "https://jobs.example.com/role#details",
      title: "Software Engineer",
      visibleText: "Visible job text",
      pageTitle: "Software Engineer",
      sourceHost: "jobs.example.com",
      capturedAt: "2026-09-28T12:00:00.000Z",
    });
  });

  it("builds the local ingestion URL without a duplicate slash", () => {
    expect(getIngestUrl("http://127.0.0.1:3000/")).toBe("http://127.0.0.1:3000/api/local/ingest/page");
  });
});