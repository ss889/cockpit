import { NextRequest, NextResponse } from "next/server";
import { readLocalWorkspace, writeLocalWorkspace } from "@/lib/localWorkspace";
import type { LocalWorkspace } from "@/types/workspace";

export async function GET() {
  return NextResponse.json({ workspace: readLocalWorkspace() });
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<LocalWorkspace>;
    const workspace = writeLocalWorkspace(body);
    return NextResponse.json({ workspace });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save local workspace";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
