import { NextRequest, NextResponse } from "next/server";

const MAX_TEXT_LENGTH = 20000;

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "A job URL is required" }, { status: 400 });
    }

    const parsedUrl = new URL(url);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: "Only http and https links are supported" }, { status: 400 });
    }

    const response = await fetch(parsedUrl.toString(), {
      headers: {
        "User-Agent": "JobOpsAI/1.0 (+https://vercel.app)",
        Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Could not fetch job link: ${response.status}` },
        { status: 502 }
      );
    }

    const html = await response.text();
    const title = extractTitle(html) || parsedUrl.hostname;
    const text = htmlToText(html).slice(0, MAX_TEXT_LENGTH);

    if (!text.trim()) {
      return NextResponse.json({ error: "No readable job text found at that link" }, { status: 422 });
    }

    return NextResponse.json({ title, text, url: parsedUrl.toString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to import job link";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function extractTitle(html: string): string {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return decodeHtml(titleMatch?.[1] || "").replace(/\s+/g, " ").trim();
}

function htmlToText(html: string): string {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6]|section|article)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
