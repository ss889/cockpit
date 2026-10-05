import type { ResumeProfile } from "./profile";
import type { AuditReport } from "./audit";

export type WorkspaceRole = "owner" | "editor" | "viewer";

export type WorkspaceSession = {
  name: string;
  role: WorkspaceRole;
  signedInAt: string;
};

export type MemoryEntry = {
  id: string;
  wing: string;
  room: string;
  drawer: string;
  title: string;
  text: string;
  createdAt: string;
};

export type InterviewPrepStory = {
  prompt: string;
  answerOutline: string;
  resumeEvidence: string;
};

export type InterviewPrepPacket = {
  generatedAt: string;
  roleSummary: string;
  likelyScreenQuestions: string[];
  technicalQuestions: string[];
  behavioralQuestions: string[];
  talkingPoints: string[];
  gapBrief: string[];
  tellMeAboutYourself: string;
  whyThisRole: string;
  stories: InterviewPrepStory[];
};

export type JobSourceType = "manual" | "extension" | "gmail" | "saved_jobs" | "browser" | "unknown";

export type JobApplicationStatus =
  | "saved"
  | "ready"
  | "applied"
  | "interviewing"
  | "offer"
  | "rejected"
  | "withdrawn"
  | "closed"
  | "ignored";

export type IngestionStatus = "pending" | "processing" | "ready" | "needs_review" | "error";

export type DeduplicationReason = "external_id" | "canonical_url" | "source_url" | "company_title" | "text_similarity";

export type RawPageCapture = {
  id: string;
  url: string;
  title?: string;
  visibleText: string;
  pageTitle?: string;
  sourceHost: string;
  capturedAt: string;
  receivedAt: string;
};

export type GmailJobCandidate = {
  messageId: string;
  threadId: string;
  sender?: string;
  subject?: string;
  receivedAt: string;
  bodyText?: string;
  links: string[];
  attachmentIds?: string[];
  syncedAt: string;
};

export type GmailSyncState = {
  connected: boolean;
  label: string;
  lastSyncAt: string | null;
  lastError?: string;
  syncedMessageIds: string[];
};

export type SavedJobReference = {
  externalId?: string;
  source: string;
  url: string;
  title?: string;
  company?: string;
  text?: string;
  capturedAt: string;
};

export type JobRequirements = {
  requiredSkills: string[];
  preferredSkills: string[];
  technologies: string[];
  responsibilities: string[];
  qualifications: string[];
  educationRequirements: string[];
  experienceRequirements: string[];
  seniority?: string;
  employmentType?: string;
  location?: string;
  remotePolicy?: string;
};

export type DeadlineConfidence = "high" | "medium" | "low" | "unknown";

export type DeadlineSource = "structured" | "text" | "llm" | "unknown";

export type DeadlineExtraction = {
  deadline: string | null;
  timezone: string | null;
  confidence: DeadlineConfidence;
  evidence: string | null;
  source: DeadlineSource;
};

export type JobFitAnalysis = {
  strongMatches: string[];
  partialMatches: string[];
  missingRequirements: string[];
  relevantExperience: string[];
  resumeFocus: string[];
  warnings: string[];
};

export type TailoredResumeVersion = {
  id: string;
  jobId: string;
  baseResumeVersion: string;
  provider: string;
  model: string;
  generatedAt: string;
  promptVersion: string;
  latex: string;
  qaBefore: number;
  qaAfter: number;
};

export type JobDescriptionEntry = {
  id: string;
  title: string;
  company: string;
  url?: string;
  text: string;
  createdAt: string;
  tailoredLatex?: string;
  tailoredAt?: string;
  status?: "saved" | "tailoring" | "ready" | "error";
  error?: string;
  interviewPrep?: InterviewPrepPacket;
  prepStatus?: "idle" | "generating" | "ready" | "error";
  prepError?: string;
  auditReport?: AuditReport;
  auditStatus?: "idle" | "auditing" | "ready" | "error";
  auditError?: string;
  sourceType?: JobSourceType;
  sourceName?: string;
  externalId?: string;
  sourceUrl?: string;
  canonicalUrl?: string;
  importedAt?: string;
  updatedAt?: string;
  applicationStatus?: JobApplicationStatus;
  ingestionStatus?: IngestionStatus;
  sourceMetadata?: Record<string, unknown>;
  processingError?: string;
  duplicateOf?: string;
  deduplicationReason?: DeduplicationReason;
  requirements?: JobRequirements;
  deadline?: string;
  deadlineTimezone?: string;
  deadlineText?: string;
  deadlineConfidence?: DeadlineConfidence;
  deadlineEvidence?: string;
  deadlineSource?: DeadlineSource;
  fitAnalysis?: JobFitAnalysis;
  resumeVersions?: TailoredResumeVersion[];
};

export type LocalWorkspace = {
  session: WorkspaceSession | null;
  memories: MemoryEntry[];
  jobDescriptions: JobDescriptionEntry[];
  baseResumeProfile: ResumeProfile | null;
  sourceCaptures?: RawPageCapture[];
  gmail?: GmailSyncState;
  gmailCandidates?: GmailJobCandidate[];
  updatedAt: string | null;
};
