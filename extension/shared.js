export const DEFAULT_AGENT_URL = "http://127.0.0.1:3000";
export const DEFAULT_JOBOPS_URL = "http://127.0.0.1:3000/workspace";
export const INGEST_PATH = "/api/local/ingest/page";
export const MAX_VISIBLE_TEXT_LENGTH = 100_000;

export function buildCapture(tab, visibleText, capturedAt = new Date().toISOString()) {
  const pageUrl = new URL(tab.url);
  return {
    url: pageUrl.toString(),
    title: typeof tab.title === "string" ? tab.title.slice(0, 500) : undefined,
    visibleText: visibleText.trim().slice(0, MAX_VISIBLE_TEXT_LENGTH),
    pageTitle: typeof tab.title === "string" ? tab.title.slice(0, 500) : undefined,
    sourceHost: pageUrl.hostname,
    capturedAt,
  };
}

export function getIngestUrl(agentUrl) {
  return `${agentUrl.replace(/\/$/, "")}${INGEST_PATH}`;
}