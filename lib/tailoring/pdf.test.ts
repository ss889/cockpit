import { describe, expect, it } from "vitest";
import { compileLatexToPdf, resolvePdflatexBinary } from "@/lib/tailoring/pdf";

describe("LaTeX PDF export", () => {
  it("rejects incomplete source before invoking a compiler", async () => {
    await expect(compileLatexToPdf("not a LaTeX document")).rejects.toThrow("complete document");
  });

  it("requires source text", async () => {
    await expect(compileLatexToPdf(" ")).rejects.toThrow("LaTeX source is required");
  });

  it("resolves a usable pdflatex binary on Windows installs", async () => {
    if (process.platform !== "win32") {
      return;
    }

    const binary = await resolvePdflatexBinary();
    expect(binary).toBeTruthy();
    expect(binary.toLowerCase()).toContain("pdflatex");
  });
});