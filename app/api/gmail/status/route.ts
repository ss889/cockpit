import { NextResponse } from "next/server";
import { hasStoredGmailToken } from "@/lib/gmail";
import { readLocalWorkspace } from "@/lib/localWorkspace";

export const runtime = "nodejs";

export async function GET() {
  const workspace = readLocalWorkspace();
  return NextResponse.json({
    gmail: {
      ...(workspace.gmail || { connected: false, label: "JobOps", lastSyncAt: null, syncedMessageIds: [] }),
      connected: Boolean(workspace.gmail?.connected && hasStoredGmailToken()),
    },
  });
}