import { afterEach, describe, expect, it } from "vitest";
import { emptyWorkspace } from "@/lib/localWorkspace";
import {
  GMAIL_READONLY_SCOPE,
  extractGmailMessage,
  getGmailAuthorizationUrl,
  ingestGmailCandidate,
  isLikelyJobCandidate,
} from "@/lib/gmail";

describe("Gmail read-only connector", () => {
  const originalClientId = process.env.GOOGLE_CLIENT_ID;

  afterEach(() => {
    if (originalClientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = originalClientId;
  });

  it("requests only the Gmail readonly scope", () => {
    process.env.GOOGLE_CLIENT_ID = "client-id";
    const url = new URL(getGmailAuthorizationUrl("state-value", "http://localhost/callback"));

    expect(url.searchParams.get("scope")).toBe(GMAIL_READONLY_SCOPE);
    expect(url.searchParams.get("state")).toBe("state-value");
    expect(url.searchParams.get("access_type")).toBe("offline");
  });

  it("extracts bounded candidate fields and links from a Gmail message", () => {
    const encoded = Buffer.from("Apply at https://jobs.example.com/roles/42").toString("base64url");
    const candidate = extractGmailMessage({
      id: "message-1",
      threadId: "thread-1",
      internalDate: "1790596800000",
      payload: {
        headers: [
          { name: "Subject", value: "Software Engineer opportunity" },
          { name: "From", value: "Recruiter <recruiter@example.com>" },
        ],
        body: { data: encoded },
      },
    });

    expect(candidate.messageId).toBe("message-1");
    expect(candidate.subject).toBe("Software Engineer opportunity");
    expect(candidate.links).toEqual(["https://jobs.example.com/roles/42"]);
    expect(isLikelyJobCandidate(candidate)).toBe(true);
  });

  it("does not convert unrelated labeled mail into jobs", () => {
    const candidate = {
      messageId: "newsletter-1",
      threadId: "thread-2",
      receivedAt: "2026-09-28T12:00:00.000Z",
      bodyText: "Weekly product newsletter",
      links: ["https://example.com/newsletter"],
      syncedAt: "2026-09-28T12:00:00.000Z",
    };

    expect(isLikelyJobCandidate(candidate)).toBe(false);
    expect(ingestGmailCandidate(candidate, emptyWorkspace()).jobDescriptions).toHaveLength(0);
  });

  it("makes message import idempotent", () => {
    const candidate = {
      messageId: "message-2",
      threadId: "thread-2",
      subject: "Apply for role",
      receivedAt: "2026-09-28T12:00:00.000Z",
      bodyText: "Apply for this job at https://jobs.example.com/roles/2",
      links: ["https://jobs.example.com/roles/2"],
      syncedAt: "2026-09-28T12:00:00.000Z",
    };
    const first = ingestGmailCandidate(candidate, emptyWorkspace());
    const second = ingestGmailCandidate(candidate, first);

    expect(first.jobDescriptions).toHaveLength(1);
    expect(second.jobDescriptions).toHaveLength(1);
    expect(second.jobDescriptions[0].externalId).toBe("message-2");
  });
});