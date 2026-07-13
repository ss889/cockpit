import type { ResumeProfile } from "./profile";

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
};

export type LocalWorkspace = {
  session: WorkspaceSession | null;
  memories: MemoryEntry[];
  jobDescriptions: JobDescriptionEntry[];
  baseResumeProfile: ResumeProfile | null;
  updatedAt: string | null;
};
