import { NextRequest, NextResponse } from "next/server";
import { assessMatch } from "@/app/api/tailor/route";
import type { ResumeProfile } from "@/types/profile";

export async function POST(request: NextRequest) {
  try {
    const { profile, keywords } = await request.json();
    if (!isResumeProfile(profile) || !Array.isArray(keywords)) {
      return NextResponse.json({ error: "A resume profile and keyword list are required" }, { status: 400 });
    }

    return NextResponse.json({ match: await assessMatch(profile, keywords.map(String)) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reassess resume";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function isResumeProfile(value: unknown): value is ResumeProfile {
  if (!value || typeof value !== "object") return false;
  const profile = value as Partial<ResumeProfile>;
  return (
    !!profile.header &&
    Array.isArray(profile.education) &&
    Array.isArray(profile.skills) &&
    Array.isArray(profile.projects) &&
    Array.isArray(profile.experience)
  );
}