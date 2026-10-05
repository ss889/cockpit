import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { inferJobMetadata } from "@/lib/jobMetadata";
import type { GmailJobCandidate, LocalWorkspace } from "@/types/workspace";

export const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";
const TOKEN_FILE = process.env.JOBOPS_GMAIL_TOKEN_FILE || path.join(os.homedir(), ".jobops", "gmail-token.json");

type GmailToken = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
};

type GmailMessage = {
  id: string;
  threadId: string;
  internalDate?: string;
  payload?: {
    headers?: { name: string; value: string }[];
    mimeType?: string;
    body?: { data?: string };
    parts?: GmailMessage["payload"][];
  };
};

export type GmailSyncResult = {
  workspace: LocalWorkspace;
  importedCandidates: number;
  importedJobs: number;
  skippedMessages: number;
};

export function getGmailRedirectUri(): string {
  return process.env.JOBOPS_GMAIL_REDIRECT_URI || "http://localhost:3000/api/gmail/callback";
}

export function getGmailAuthorizationUrl(state: string, redirectUri = getGmailRedirectUri()): string {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID is not configured");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: GMAIL_READONLY_SCOPE,
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export function createOAuthState(): string {
  return crypto.randomBytes(24).toString("hex");
}

export function extractGmailMessage(message: GmailMessage, syncedAt = new Date().toISOString()): GmailJobCandidate {
  const headers = new Map((message.payload?.headers || []).map((header) => [header.name.toLowerCase(), header.value]));
  const bodyText = extractBodyText(message.payload).slice(0, 20_000);
  const links = [...new Set(bodyText.match(/https?:\/\/[^\s<>"')]+/gi) || [])].slice(0, 20);
  return {
    messageId: message.id,
    threadId: message.threadId,
    sender: headers.get("from"),
    subject: headers.get("subject"),
    receivedAt: new Date(Number(message.internalDate || Date.now())).toISOString(),
    bodyText,
    links,
    syncedAt,
  };
}

export function isLikelyJobCandidate(candidate: GmailJobCandidate): boolean {
  const haystack = `${candidate.subject || ""} ${candidate.bodyText || ""}`.toLowerCase();
  const jobLanguage = /\b(job|role|position|career|recruit|interview|application|hiring|opportunity)\b/.test(haystack);
  const jobLink = candidate.links.some((link) => /greenhouse|lever\.co|ashbyhq|workday|jobs?|careers?/i.test(link));
  return jobLanguage && (jobLink || candidate.links.length > 0);
}

export function ingestGmailCandidate(candidate: GmailJobCandidate, workspace: LocalWorkspace): LocalWorkspace {
  if (!isLikelyJobCandidate(candidate)) return workspace;
  if (workspace.jobDescriptions.some((job) => job.externalId === candidate.messageId && job.sourceName === "gmail")) {
    return workspace;
  }

  const text = [candidate.subject, candidate.sender, candidate.bodyText].filter(Boolean).join("\n\n");
  const url = candidate.links[0];
  const metadata = inferJobMetadata(text, url, candidate.subject);
  const capturedAt = candidate.receivedAt;
  const job = {
    id: `job-gmail-${candidate.messageId}`,
    title: metadata.title,
    company: metadata.company,
    url,
    text,
    createdAt: capturedAt,
    sourceType: "gmail" as const,
    sourceName: "gmail",
    sourceUrl: url,
    canonicalUrl: url,
    externalId: candidate.messageId,
    importedAt: candidate.syncedAt,
    updatedAt: candidate.syncedAt,
    applicationStatus: "saved" as const,
    ingestionStatus: "pending" as const,
    sourceMetadata: { messageId: candidate.messageId, threadId: candidate.threadId },
    status: "saved" as const,
  };
  return { ...workspace, jobDescriptions: [job, ...workspace.jobDescriptions] };
}

export async function syncGmailWorkspace(workspace: LocalWorkspace, label = workspace.gmail?.label || "JobOps"): Promise<GmailSyncResult> {
  const accessToken = await getAccessToken();
  const labels = await gmailRequest<{ labels?: { id: string; name: string }[] }>(accessToken, "/labels");
  const labelId = labels.labels?.find((item) => item.name === label)?.id;
  if (!labelId) throw new Error(`Gmail label not found: ${label}`);

  const listed = await gmailRequest<{ messages?: { id: string; threadId: string }[] }>(
    accessToken,
    `/messages?labelIds=${encodeURIComponent(labelId)}&maxResults=50`
  );
  const syncedIds = new Set(workspace.gmail?.syncedMessageIds || []);
  let nextWorkspace = workspace;
  let importedCandidates = 0;
  let importedJobs = 0;
  let skippedMessages = 0;
  const syncedAt = new Date().toISOString();
  const candidates = [...(workspace.gmailCandidates || [])];

  for (const listedMessage of listed.messages || []) {
    if (syncedIds.has(listedMessage.id)) {
      skippedMessages += 1;
      continue;
    }
    const message = await gmailRequest<GmailMessage>(accessToken, `/messages/${encodeURIComponent(listedMessage.id)}?format=full`);
    const candidate = extractGmailMessage(message, syncedAt);
    candidates.push(candidate);
    importedCandidates += 1;
    const before = nextWorkspace.jobDescriptions.length;
    nextWorkspace = ingestGmailCandidate(candidate, nextWorkspace);
    if (nextWorkspace.jobDescriptions.length > before) importedJobs += 1;
    syncedIds.add(candidate.messageId);
  }

  return {
    workspace: {
      ...nextWorkspace,
      gmail: { connected: true, label, lastSyncAt: syncedAt, syncedMessageIds: [...syncedIds] },
      gmailCandidates: candidates.slice(-200),
    },
    importedCandidates,
    importedJobs,
    skippedMessages,
  };
}

export function hasStoredGmailToken(): boolean {
  return fs.existsSync(TOKEN_FILE);
}

export function clearGmailToken(): void {
  if (fs.existsSync(TOKEN_FILE)) fs.rmSync(TOKEN_FILE);
}

async function getAccessToken(): Promise<string> {
  const token = readToken();
  if (token?.accessToken && (!token.expiresAt || token.expiresAt > Date.now() + 60_000)) return token.accessToken;
  if (!token?.refreshToken) throw new Error("Gmail is not connected");
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) throw new Error("Google OAuth credentials are not configured");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: token.refreshToken, grant_type: "refresh_token" }),
  });
  if (!response.ok) throw new Error("Could not refresh Gmail authorization");
  const refreshed = await response.json() as { access_token: string; expires_in?: number };
  writeToken({ ...token, accessToken: refreshed.access_token, expiresAt: Date.now() + (refreshed.expires_in || 3600) * 1000 });
  return refreshed.access_token;
}

export async function exchangeGmailCode(code: string, redirectUri = getGmailRedirectUri()): Promise<void> {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) throw new Error("Google OAuth credentials are not configured");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
  });
  if (!response.ok) throw new Error("Could not complete Gmail authorization");
  const data = await response.json() as { access_token: string; refresh_token?: string; expires_in?: number };
  writeToken({ accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 });
}

function readToken(): GmailToken | null {
  try {
    return JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8")) as GmailToken;
  } catch {
    return null;
  }
}

function writeToken(token: GmailToken): void {
  fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true });
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(token, null, 2), { mode: 0o600 });
}

async function gmailRequest<T>(accessToken: string, pathName: string): Promise<T> {
  const response = await fetch(`${GMAIL_API}${pathName}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error(`Gmail request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

function extractBodyText(payload?: GmailMessage["payload"]): string {
  if (!payload) return "";
  const chunks = [payload.body?.data, ...(payload.parts || []).map(extractBodyText)].filter(Boolean) as string[];
  return chunks.map(decodeBase64Url).join("\n");
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}