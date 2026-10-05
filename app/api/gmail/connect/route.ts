import { NextResponse } from "next/server";
import { createOAuthState, getGmailAuthorizationUrl } from "@/lib/gmail";

export const runtime = "nodejs";

export async function GET() {
  const state = createOAuthState();
  const response = NextResponse.redirect(getGmailAuthorizationUrl(state));
  response.cookies.set("jobops_gmail_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/api/gmail",
  });
  return response;
}