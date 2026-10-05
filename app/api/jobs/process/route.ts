import { NextRequest, NextResponse } from "next/server";
import { enqueue } from "@/lib/queue";
import { readLocalWorkspace } from "@/lib/localWorkspace";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { jobId?: string };
    if (!body.jobId || typeof body.jobId !== "string") {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }
    const job = readLocalWorkspace().jobDescriptions.find((item) => item.id === body.jobId);
    if (!job) return NextResponse.json({ error: "Saved job not found" }, { status: 404 });
    const queued = enqueue("process_job", { jobId: body.jobId }, { maxRetries: 2 });
    return NextResponse.json({ status: "queued", job: queued });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not queue job processing";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}