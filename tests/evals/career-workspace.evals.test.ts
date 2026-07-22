import { describe, expect, it } from "vitest";
import { renderInterviewPrepMarkdown } from "@/lib/interviewPrep";
import { inferJobMetadata } from "@/lib/jobMetadata";
import { renderResumeLatex } from "@/lib/renderLatex";
import { runQA } from "@/lib/resumeQA";
import { evalInterviewPrep, evalJobDescriptions, evalResumeProfile } from "./fixtures";

describe("career workspace evals", () => {
  it("keeps clean tailored resume profiles inside deterministic quality gates", () => {
    const keywords = ["TypeScript", "Python", "Claude API", "RAG", "evaluation"];
    const issues = runQA(evalResumeProfile, keywords);

    expect(issues).toEqual([]);
  });

  it("keeps rendered LaTeX ATS-friendly", () => {
    const latex = renderResumeLatex(evalResumeProfile);

    expect(latex).toContain("\\documentclass");
    expect(latex).toContain("\\section{Projects}");
    expect(latex).toContain("\\section{Experience}");
    expect(latex).toContain("\\begin{itemize}[label={\\textbullet}]");
    expect(latex).not.toContain("\\begin{tabular");
    expect(latex).not.toContain("\\usepackage{tabularx}");
    expect(latex).not.toContain("\\twocolumn");
    expect(latex).not.toContain("\\includegraphics");
  });

  it.each(evalJobDescriptions)("infers metadata for $name", (fixture) => {
    const metadata = inferJobMetadata(fixture.text, fixture.url, fixture.pageTitle);

    expect(metadata.title).toBe(fixture.expectedTitle);
    expect(metadata.company).toBe(fixture.expectedCompany);
  });

  it("exports interview prep as portable grounded markdown", () => {
    const markdown = renderInterviewPrepMarkdown("AI Engineer Intern", "The Muse", evalInterviewPrep);

    expect(markdown).toContain("# Interview Prep: AI Engineer Intern at The Muse");
    expect(markdown).toContain("## Role Read");
    expect(markdown).toContain("## Talking Points");
    expect(markdown).toContain("JobOps AI");
    expect(markdown).toContain("## Gap Brief");
    expect(markdown).not.toContain("undefined");
    expect(markdown).not.toContain("[object Object]");
  });
});
