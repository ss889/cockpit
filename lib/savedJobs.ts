import { randomUUID } from "node:crypto";
import { inferJobMetadata } from "@/lib/jobMetadata";
import { normalizePageUrl } from "@/lib/localIngestion";
import type { JobDescriptionEntry, LocalWorkspace, SavedJobReference } from "@/types/workspace";

export interface BrowserSourceAdapter {
  sourceName: string;
  matches(url: string): boolean;
  extractSavedJobs(capture: SavedJobsPageCapture): SavedJobReference[];
}

export type SavedJobsPageCapture = {
  url: string;
  visibleText: string;
  capturedAt: string;
};

export type SavedJobsSyncResult = {
  workspace: LocalWorkspace;
  source: string;
  imported: number;
  duplicates: number;
  references: SavedJobReference[];
};

function findTitleNearUrl(lines: string[], jobUrl: string): string | undefined {
  const lineIndex = lines.findIndex((line) => line.includes(jobUrl));
  if (lineIndex === -1) return undefined;

  const line = lines[lineIndex];
  const sameLineTitle = extractTitleFromLine(line, jobUrl);
  if (sameLineTitle) return sameLineTitle;

  for (let offset = 1; offset <= 3; offset += 1) {
    const candidates = [lines[lineIndex - offset], lines[lineIndex + offset]].filter((value): value is string => Boolean(value));
    const title = candidates.find((candidate) => !candidate.includes("http") && !/^https?:\/\//i.test(candidate));
    if (title) return normalizeTitle(title);
  }

  const previous = lines[lineIndex - 1];
  if (previous && !previous.includes("http") && !/^https?:\/\//i.test(previous)) {
    return normalizeTitle(previous);
  }

  return undefined;
}

function extractTitleFromLine(line: string, jobUrl: string): string | undefined {
  const rawUrls = [...line.matchAll(/https?:\/\/[^\s<>")']+/gi)].map((match) => match[0]);
  const matchingUrl = rawUrls.find((url) => normalizePageUrl(url) === normalizePageUrl(jobUrl));
  if (!matchingUrl) return undefined;

  const index = line.indexOf(matchingUrl);
  if (index === -1) return undefined;

  const before = line.slice(0, index).trim();
  const after = line.slice(index + matchingUrl.length).trim();
  const candidate = before || after;
  if (!candidate) return undefined;

  const cleaned = candidate.replace(/^[-–—:|\u2022\s]+/, "").replace(/[\s\-–—|]+$/, "");
  return cleaned && !cleaned.includes("http") && !/^https?:\/\//i.test(cleaned) ? normalizeTitle(cleaned) : undefined;
}

function normalizeTitle(value: string): string {
  return value.replace(/^[\s\-–—:|]+|[\s\-–—:|]+$/g, "").trim();
}

export class LinkedInSavedJobsAdapter implements BrowserSourceAdapter {
  sourceName = "linkedin";

  matches(url: string): boolean {
    return /^https?:\/\/(?:www\.)?linkedin\.com\/.*(?:saved|my-items)/i.test(url);
  }

  extractSavedJobs(capture: SavedJobsPageCapture): SavedJobReference[] {
    if (!this.matches(capture.url)) return [];
    const links = [...new Set(capture.visibleText.match(/https?:\/\/[^\s<>"')]+/gi) || [])]
      .map((url) => normalizePageUrl(url))
      .filter((url) => /linkedin\.com\/jobs\/view\//i.test(url));
    const lines = capture.visibleText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    return links.map((url) => {
      const id = url.match(/\/jobs\/view\/(\d+)/i)?.[1];
      const title = findTitleNearUrl(lines, url);
      return { externalId: id, source: this.sourceName, url, title, capturedAt: capture.capturedAt };
    });
  }
}

export class GenericSavedJobsAdapter implements BrowserSourceAdapter {
  sourceName = "browser";

  matches(url: string): boolean {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      const pathname = parsed.pathname.toLowerCase();
      const hasJobPath = /\/(?:jobs?|positions?|careers?|opportunities?|roles?|postings?|job)\b/i.test(pathname);
      const hasJobHost = /(job|career|hiring|recruit|talent|position|opportunity)/i.test(host);
      return hasJobPath || hasJobHost;
    } catch {
      return false;
    }
  }

  extractSavedJobs(capture: SavedJobsPageCapture): SavedJobReference[] {
    if (!this.matches(capture.url)) return [];
    const links = [...new Set(capture.visibleText.match(/https?:\/\/[^\s<>"')]+/gi) || [])]
      .map((url) => normalizePageUrl(url))
      .filter((url) => {
        try {
          const parsed = new URL(url);
          const pathname = parsed.pathname.toLowerCase();
          return /\/(?:jobs?|positions?|careers?|opportunities?|roles?|postings?|job)\b/i.test(pathname);
        } catch {
          return false;
        }
      });
    const lines = capture.visibleText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    return links.map((url) => {
      const parsed = new URL(url);
      const source = parsed.hostname.toLowerCase().replace(/^www\./, "");
      const id = parsed.pathname.split("/").filter(Boolean).at(-1) || undefined;
      const title = findTitleNearUrl(lines, url);
      return { externalId: id, source, url, title, capturedAt: capture.capturedAt };
    });
  }
}

export function getSavedJobsAdapter(url: string): BrowserSourceAdapter | null {
  const adapters: BrowserSourceAdapter[] = [new LinkedInSavedJobsAdapter(), new GenericSavedJobsAdapter()];
  return adapters.find((adapter) => adapter.matches(url)) ?? null;
}

export function syncSavedJobReferences(
  references: SavedJobReference[],
  workspace: LocalWorkspace
): SavedJobsSyncResult {
  let nextWorkspace = workspace;
  let imported = 0;
  let duplicates = 0;
  for (const reference of references) {
    const existing = nextWorkspace.jobDescriptions.find((job) =>
      (reference.externalId && job.externalId === reference.externalId && job.sourceName === reference.source) ||
      job.canonicalUrl === reference.url
    );
    if (existing) {
      duplicates += 1;
      continue;
    }
    const text = reference.text || reference.title || "Saved job reference requires review.";
    const metadata = inferJobMetadata(text, reference.url, reference.title);
    const job: JobDescriptionEntry = {
      id: `job-${randomUUID()}`,
      title: reference.title || metadata.title,
      company: reference.company || metadata.company,
      url: reference.url,
      text,
      createdAt: reference.capturedAt,
      sourceType: "saved_jobs",
      sourceName: reference.source,
      externalId: reference.externalId,
      sourceUrl: reference.url,
      canonicalUrl: reference.url,
      importedAt: reference.capturedAt,
      updatedAt: reference.capturedAt,
      applicationStatus: "saved",
      ingestionStatus: "needs_review",
      sourceMetadata: { adapter: reference.source, referenceOnly: !reference.text },
      status: "saved",
    };
    nextWorkspace = { ...nextWorkspace, jobDescriptions: [job, ...nextWorkspace.jobDescriptions] };
    imported += 1;
  }
  return { workspace: nextWorkspace, source: references[0]?.source || "unknown", imported, duplicates, references };
}