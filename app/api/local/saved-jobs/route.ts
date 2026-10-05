import { NextRequest, NextResponse } from "next/server";
import { getSavedJobsAdapter, syncSavedJobReferences } from "@/lib/savedJobs";
import { readLocalWorkspace, writeLocalWorkspace } from "@/lib/localWorkspace";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const expectedToken = process.env.JOBOPS_LOCAL_TOKEN?.trim();
  if (!expectedToken || request.headers.get("authorization") !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: "Invalid local agent credentials" }, { status: 401 });
  }
  try {
    const body = await request.json() as { url?: string; visibleText?: string; capturedAt?: string };
    if (!body.url || !body.visibleText || !body.capturedAt) {
      return NextResponse.json({ error: "url, visibleText, and capturedAt are required" }, { status: 400 });
    }
    const adapter = getSavedJobsAdapter(body.url);
    if (!adapter) return NextResponse.json({ error: "Saved-job automation unavailable for this source", fallback: "Open the job page and use Capture with JobOps." }, { status: 422 });
    const references = adapter.extractSavedJobs({ url: body.url, visibleText: body.visibleText, capturedAt: body.capturedAt });
    const result = syncSavedJobReferences(references, readLocalWorkspace());
    writeLocalWorkspace(result.workspace);
    return NextResponse.json({ source: result.source, imported: result.imported, duplicates: result.duplicates, references: result.references.length });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Saved-job sync failed" }, { status: 400 });
  }
}