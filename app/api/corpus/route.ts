import { NextRequest, NextResponse } from "next/server";
import { saveJobDescription, searchSimilar, listCorpus } from "@/lib/database";
import { embeddingsAvailable } from "@/lib/embeddings";
import { embedAndSave } from "@/lib/vector";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");
  if (q) {
    const results = searchSimilar(q, 10);
    return NextResponse.json({ results });
  }
  return NextResponse.json({ results: listCorpus() });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, meta } = body;
    if (!text) return NextResponse.json({ error: "text required" }, { status: 400 });
    let entry;
    if (embeddingsAvailable()) {
      entry = await embedAndSave(text, meta);
    } else {
      entry = saveJobDescription(text, meta);
    }
    return NextResponse.json({ entry });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
