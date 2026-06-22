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
};

export type LocalWorkspace = {
  session: WorkspaceSession | null;
  memories: MemoryEntry[];
  jobDescriptions: JobDescriptionEntry[];
  baseResumeProfile: ResumeProfile | null;
  updatedAt: string | null;
};
