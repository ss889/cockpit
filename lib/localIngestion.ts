import { randomUUID } from "node:crypto";
import { inferJobMetadata } from "@/lib/jobMetadata";
import type {
  DeduplicationReason,
  JobDescriptionEntry,
  LocalWorkspace,
  RawPageCapture,
} from "@/types/workspace";

export const MAX_CAPTURE_TEXT_LENGTH = 100_000;
export const MAX_CAPTURE_TITLE_LENGTH = 500;
export const MAX_EXTERNAL_ID_LENGTH = 300;

export type PageCapturePayload = {
  url: string;
  title?: string;
  visibleText: string;
  pageTitle?: string;
  sourceHost: string;
  capturedAt: string;
  externalId?: string;
};

export type IngestResult = {
  workspace: LocalWorkspace;
  job: JobDescriptionEntry;
  capture: RawPageCapture;
  action: "created" | "duplicate" | "needs_review";
  deduplicationReason?: DeduplicationReason;
};

export function normalizePageUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) {
    url.port = "";
  }
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith("utm_") || ["fbclid", "gclid"].includes(key.toLowerCase())) {
      url.searchParams.delete(key);
    }
  }
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

export function validatePageCapture(value: unknown): PageCapturePayload {
  if (!value || typeof value !== "object") throw new Error("A page capture is required");
  const payload = value as Partial<PageCapturePayload>;
  if (typeof payload.url !== "string" || !/^https?:\/\//i.test(payload.url)) {
    throw new Error("A valid http or https URL is required");
  }
  const parsedUrl = new URL(payload.url);
  if (!parsedUrl.hostname) throw new Error("A URL hostname is required");
  if (typeof payload.sourceHost !== "string" || payload.sourceHost.trim().toLowerCase() !== parsedUrl.hostname.toLowerCase()) {
    throw new Error("sourceHost must match the capture URL hostname");
  }
  if (typeof payload.visibleText !== "string" || !payload.visibleText.trim()) {
    throw new Error("visibleText is required");
  }
  if (payload.visibleText.length > MAX_CAPTURE_TEXT_LENGTH) {
    throw new Error(`visibleText must be ${MAX_CAPTURE_TEXT_LENGTH} characters or fewer`);
  }
  for (const [field, value, maxLength] of [
    ["title", payload.title, MAX_CAPTURE_TITLE_LENGTH],
    ["pageTitle", payload.pageTitle, MAX_CAPTURE_TITLE_LENGTH],
    ["externalId", payload.externalId, MAX_EXTERNAL_ID_LENGTH],
  ] as const) {
    if (value !== undefined && (typeof value !== "string" || value.length > maxLength)) {
      throw new Error(`${field} must be ${maxLength} characters or fewer`);
    }
  }
  if (typeof payload.capturedAt !== "string" || Number.isNaN(Date.parse(payload.capturedAt))) {
    throw new Error("capturedAt must be a valid ISO timestamp");
  }

  return {
    url: normalizePageUrl(payload.url),
    title: payload.title?.trim() || undefined,
    visibleText: payload.visibleText.trim(),
    pageTitle: payload.pageTitle?.trim() || undefined,
    sourceHost: parsedUrl.hostname.toLowerCase(),
    capturedAt: new Date(payload.capturedAt).toISOString(),
    externalId: payload.externalId?.trim() || undefined,
  };
}

export function ingestPageCapture(payload: PageCapturePayload, workspace: LocalWorkspace, now = new Date()): IngestResult {
  const metadata = inferJobMetadata(payload.visibleText, payload.url, payload.pageTitle || payload.title);
  const match = findDuplicate(payload, metadata, workspace.jobDescriptions);
  const receivedAt = now.toISOString();
  const capture: RawPageCapture = {
    id: `capture-${randomUUID()}`,
    ...payload,
    receivedAt,
  };

  if (match && match.reason !== "text_similarity") {
    return {
      workspace: {
        ...workspace,
        sourceCaptures: [...(workspace.sourceCaptures ?? []), capture],
      },
      job: match.job,
      capture,
      action: "duplicate",
      deduplicationReason: match.reason,
    };
  }

  const needsReview = match?.reason === "text_similarity";
  const job: JobDescriptionEntry = {
    id: `job-${randomUUID()}`,
    title: metadata.title,
    company: metadata.company,
    url: payload.url,
    text: payload.visibleText,
    createdAt: receivedAt,
    sourceType: "extension",
    sourceName: payload.sourceHost,
    externalId: payload.externalId,
    sourceUrl: payload.url,
    canonicalUrl: payload.url,
    importedAt: receivedAt,
    updatedAt: receivedAt,
    applicationStatus: "saved",
    ingestionStatus: needsReview ? "needs_review" : "pending",
    sourceMetadata: { captureId: capture.id },
    status: "saved",
    ...(needsReview && {
      duplicateOf: match.job.id,
      deduplicationReason: match.reason,
    }),
  };

  return {
    workspace: {
      ...workspace,
      jobDescriptions: [job, ...workspace.jobDescriptions],
      sourceCaptures: [...(workspace.sourceCaptures ?? []), capture],
    },
    job,
    capture,
      action: needsReview ? "needs_review" : "created",
      ...(needsReview && { deduplicationReason: match.reason }),
  };
}

type DuplicateMatch = { job: JobDescriptionEntry; reason: DeduplicationReason };

function findDuplicate(
  payload: PageCapturePayload,
  metadata: { title: string; company: string },
  jobs: JobDescriptionEntry[]
): DuplicateMatch | null {
  const externalMatch = payload.externalId
    ? jobs.find((job) => job.externalId === payload.externalId && job.sourceName === payload.sourceHost)
    : undefined;
  if (externalMatch) return { job: externalMatch, reason: "external_id" };

  const canonicalMatch = jobs.find((job) => job.canonicalUrl === payload.url);
  if (canonicalMatch) return { job: canonicalMatch, reason: "canonical_url" };

  const sourceUrlMatch = jobs.find((job) => job.sourceUrl === payload.url || job.url === payload.url);
  if (sourceUrlMatch) return { job: sourceUrlMatch, reason: "source_url" };

  const title = normalizeIdentity(metadata.title);
  const company = normalizeIdentity(metadata.company);
  const companyTitleMatch = jobs.find(
    (job) => normalizeIdentity(job.title) === title && normalizeIdentity(job.company) === company && Boolean(company)
  );
  if (companyTitleMatch) return { job: companyTitleMatch, reason: "company_title" };

  const similarJob = jobs.find((job) => {
    if (!company || normalizeIdentity(job.company) !== company) return false;
    return textSimilarity(job.text, payload.visibleText) >= 0.75;
  });
  return similarJob ? { job: similarJob, reason: "text_similarity" } : null;
}

function normalizeIdentity(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function textSimilarity(left: string, right: string): number {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  let intersection = 0;
  for (const token of leftTokens) if (rightTokens.has(token)) intersection += 1;
  return intersection / new Set([...leftTokens, ...rightTokens]).size;
}

function tokenize(value: string): string[] {
  return value.toLowerCase().match(/[a-z0-9+#.-]{3,}/g) ?? [];
}