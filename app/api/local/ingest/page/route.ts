import { NextRequest, NextResponse } from "next/server";
import { ingestPageCapture, validatePageCapture } from "@/lib/localIngestion";
import { readLocalWorkspace, writeLocalWorkspace } from "@/lib/localWorkspace";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const expectedToken = process.env.JOBOPS_LOCAL_TOKEN?.trim();
  const authorization = request.headers.get("authorization");
  if (!expectedToken || authorization !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: "Invalid local agent credentials" }, { status: 401 });
  }

  try {
    const payload = validatePageCapture(await request.json());
    const result = ingestPageCapture(payload, readLocalWorkspace());
    if (result.action === "created" || result.action === "needs_review") writeLocalWorkspace(result.workspace);
    else writeLocalWorkspace({ sourceCaptures: result.workspace.sourceCaptures });

    return NextResponse.json({ jobId: result.job.id, action: result.action });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid page capture";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}