import fs from "fs";
import path from "path";
import { getDataDir } from "./dataDir";
import type { LocalWorkspace } from "@/types/workspace";

const WORKSPACE_FILE = path.join(getDataDir(), "local-workspace.json");

export function emptyWorkspace(): LocalWorkspace {
  return {
    session: null,
    memories: [],
    jobDescriptions: [],
    baseResumeProfile: null,
    updatedAt: null,
  };
}

export function readLocalWorkspace(): LocalWorkspace {
  try {
    ensureWorkspaceDir();
    if (!fs.existsSync(WORKSPACE_FILE)) return emptyWorkspace();
    const raw = fs.readFileSync(WORKSPACE_FILE, "utf8");
    return normalizeWorkspace(JSON.parse(raw || "{}"));
  } catch {
    return emptyWorkspace();
  }
}

export function writeLocalWorkspace(workspace: Partial<LocalWorkspace>): LocalWorkspace {
  ensureWorkspaceDir();
  const current = readLocalWorkspace();
  const next = normalizeWorkspace({
    ...current,
    ...workspace,
    updatedAt: new Date().toISOString(),
  });
  fs.writeFileSync(WORKSPACE_FILE, JSON.stringify(next, null, 2));
  return next;
}

function ensureWorkspaceDir() {
  const dir = path.dirname(WORKSPACE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function normalizeWorkspace(value: Partial<LocalWorkspace>): LocalWorkspace {
  return {
    session: value.session ?? null,
    memories: Array.isArray(value.memories) ? value.memories : [],
    jobDescriptions: Array.isArray(value.jobDescriptions) ? value.jobDescriptions : [],
    baseResumeProfile: value.baseResumeProfile ?? null,
    updatedAt: value.updatedAt ?? null,
  };
}
