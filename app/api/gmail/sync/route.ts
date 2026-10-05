import { NextRequest, NextResponse } from "next/server";
import { syncGmailWorkspace } from "@/lib/gmail";
import { readLocalWorkspace, writeLocalWorkspace } from "@/lib/localWorkspace";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const workspace = readLocalWorkspace();
  try {
    const body = await request.json().catch(() => ({})) as { label?: string };
    const label = typeof body.label === "string" && body.label.trim() ? body.label.trim() : workspace.gmail?.label || "JobOps";
    const result = await syncGmailWorkspace(workspace, label);
    writeLocalWorkspace(result.workspace);
    return NextResponse.json({
      importedCandidates: result.importedCandidates,
      importedJobs: result.importedJobs,
      skippedMessages: result.skippedMessages,
      gmail: result.workspace.gmail,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gmail sync failed";
    writeLocalWorkspace({ gmail: { ...(workspace.gmail || { connected: false, label: "JobOps", lastSyncAt: null, syncedMessageIds: [] }), lastError: message } });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}