import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthRedirectPath } from "@/lib/authRedirect";

export function proxy(request: NextRequest) {
  const isSignedIn = request.cookies.has("jobops_workspace_session");
  const redirectPath = getAuthRedirectPath(request.nextUrl.pathname, isSignedIn);

  if (redirectPath) {
    return NextResponse.redirect(new URL(redirectPath, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/workspace"],
};
