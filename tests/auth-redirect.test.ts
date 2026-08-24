import { describe, expect, it } from "vitest";
import { getAuthRedirectPath } from "@/lib/authRedirect";

describe("landing/workspace auth redirects", () => {
  it("redirects authenticated root visits to workspace", () => {
    expect(getAuthRedirectPath("/", true)).toBe("/workspace");
  });

  it("redirects unauthenticated workspace visits to root", () => {
    expect(getAuthRedirectPath("/workspace", false)).toBe("/");
  });

  it("does not redirect public root visits", () => {
    expect(getAuthRedirectPath("/", false)).toBeNull();
  });

  it("does not redirect authenticated workspace visits", () => {
    expect(getAuthRedirectPath("/workspace", true)).toBeNull();
  });
});
