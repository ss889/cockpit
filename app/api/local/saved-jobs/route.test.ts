import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/local/saved-jobs/route";
import { getDataDir } from "@/lib/dataDir";
import { emptyWorkspace, readLocalWorkspace, writeLocalWorkspace } from "@/lib/localWorkspace";

const workspacePath = path.join(getDataDir(), "local-workspace.json");

describe("POST /api/local/saved-jobs", () => {
  const originalToken = process.env.JOBOPS_LOCAL_TOKEN;
  const originalWorkspace = fs.existsSync(workspacePath) ? fs.readFileSync(workspacePath, "utf8") : null;

  beforeEach(() => {
    process.env.JOBOPS_LOCAL_TOKEN = "test-local-token";
    writeLocalWorkspace(emptyWorkspace());
  });

  afterEach(() => {
    if (originalToken === undefined) delete process.env.JOBOPS_LOCAL_TOKEN;
    else process.env.JOBOPS_LOCAL_TOKEN = originalToken;

    if (originalWorkspace === null) {
      if (fs.existsSync(workspacePath)) fs.rmSync(workspacePath);
    } else {
      fs.writeFileSync(workspacePath, originalWorkspace, "utf8");
    }
  });

  it.each([undefined, "Bearer wrong-token"])("rejects missing or invalid credentials: %s", async (authorization) => {
    const request = new NextRequest("http://localhost/api/local/saved-jobs", {
      method: "POST",
      headers: authorization ? { authorization } : undefined,
      body: JSON.stringify({ url: "https://www.linkedin.com/my-items/saved-jobs/", visibleText: "", capturedAt: "2026-10-01T00:00:00.000Z" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Invalid local agent credentials" });
  });

  it("rejects malformed payloads", async () => {
    const request = new NextRequest("http://localhost/api/local/saved-jobs", {
      method: "POST",
      headers: { authorization: "Bearer test-local-token" },
      body: JSON.stringify({ url: "https://www.linkedin.com/my-items/saved-jobs/", visibleText: "Software Engineer" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "url, visibleText, and capturedAt are required" });
  });

  it("imports a valid LinkedIn saved-job capture", async () => {
    const request = new NextRequest("http://localhost/api/local/saved-jobs", {
      method: "POST",
      headers: { authorization: "Bearer test-local-token" },
      body: JSON.stringify({
        url: "https://www.linkedin.com/my-items/saved-jobs/",
        visibleText: "Software Engineer\nhttps://www.linkedin.com/jobs/view/12345?utm_source=saved",
        capturedAt: "2026-10-01T00:00:00.000Z",
      }),
    });

    const response = await POST(request);
    const data = await response.json();
    const workspace = readLocalWorkspace();

    expect(response.status).toBe(200);
    expect(data.imported).toBe(1);
    expect(data.duplicates).toBe(0);
    expect(workspace.jobDescriptions).toHaveLength(1);
    expect(workspace.jobDescriptions[0].sourceType).toBe("saved_jobs");
    expect(workspace.jobDescriptions[0].ingestionStatus).toBe("needs_review");
    expect(workspace.jobDescriptions[0].externalId).toBe("12345");
  });

  it("returns 422 for unsupported saved-job sources", async () => {
    const request = new NextRequest("http://localhost/api/local/saved-jobs", {
      method: "POST",
      headers: { authorization: "Bearer test-local-token" },
      body: JSON.stringify({
        url: "https://example.com/blog/launch-post",
        visibleText: "Launch notes\nhttps://example.com/blog/launch-post",
        capturedAt: "2026-10-01T00:00:00.000Z",
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: "Saved-job automation unavailable for this source",
      fallback: "Open the job page and use Capture with JobOps.",
    });
  });
});
