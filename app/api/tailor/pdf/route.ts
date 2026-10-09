import { NextRequest, NextResponse } from "next/server";
import { compileLatexToPdf } from "@/lib/tailoring/pdf";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { latex } = await request.json();
    if (typeof latex !== "string") {
      return NextResponse.json({ error: "LaTeX source is required" }, { status: 400 });
    }

    const result = await compileLatexToPdf(latex);
    return new NextResponse(new Uint8Array(result.pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=tailored-resume.pdf",
        "X-JobOps-PDF-Compiler": result.compiler,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF compilation failed";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}