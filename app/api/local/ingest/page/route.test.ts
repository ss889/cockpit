import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/local/ingest/page/route";

describe("POST /api/local/ingest/page", () => {
  const originalToken = process.env.JOBOPS_LOCAL_TOKEN;

  beforeEach(() => {
    process.env.JOBOPS_LOCAL_TOKEN = "test-local-token";
  });

  afterEach(() => {
    if (originalToken === undefined) delete process.env.JOBOPS_LOCAL_TOKEN;
    else process.env.JOBOPS_LOCAL_TOKEN = originalToken;
  });

  it.each([undefined, "Bearer wrong-token"])("rejects missing or invalid credentials: %s", async (authorization) => {
    const request = new NextRequest("http://localhost/api/local/ingest/page", {
      method: "POST",
      headers: authorization ? { authorization } : undefined,
      body: JSON.stringify({}),
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Invalid local agent credentials" });
  });

  it("rejects requests when the local token is not configured", async () => {
    delete process.env.JOBOPS_LOCAL_TOKEN;
    const request = new NextRequest("http://localhost/api/local/ingest/page", {
      method: "POST",
      headers: { authorization: "Bearer test-local-token" },
      body: JSON.stringify({}),
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
  });
});