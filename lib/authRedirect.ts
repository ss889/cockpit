export function getAuthRedirectPath(pathname: string, isSignedIn: boolean): string | null {
  if (pathname === "/" && isSignedIn) return "/workspace";
  if (pathname === "/workspace" && !isSignedIn) return "/";
  return null;
}
