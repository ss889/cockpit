import { NextRequest, NextResponse } from "next/server";
import { exchangeGmailCode } from "@/lib/gmail";
import { writeLocalWorkspace } from "@/lib/localWorkspace";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get("jobops_gmail_oauth_state")?.value;
  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.json({ error: "Invalid Gmail authorization state" }, { status: 400 });
  }

  try {
    await exchangeGmailCode(code);
    writeLocalWorkspace({
      gmail: {
        connected: true,
        label: "JobOps",
        lastSyncAt: null,
        syncedMessageIds: [],
      },
    });
    const response = NextResponse.redirect(new URL("/workspace?gmail=connected", request.url));
    response.cookies.delete("jobops_gmail_oauth_state");
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gmail authorization failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}