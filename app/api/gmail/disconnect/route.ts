import { NextResponse } from "next/server";
import { clearGmailToken } from "@/lib/gmail";
import { readLocalWorkspace, writeLocalWorkspace } from "@/lib/localWorkspace";

export const runtime = "nodejs";

export async function POST() {
  clearGmailToken();
  const workspace = readLocalWorkspace();
  writeLocalWorkspace({
    gmail: {
      ...(workspace.gmail || { label: "JobOps", lastSyncAt: null, syncedMessageIds: [] }),
      connected: false,
      lastError: undefined,
    },
  });
  return NextResponse.json({ connected: false });
}