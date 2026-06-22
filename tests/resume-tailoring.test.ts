import { describe, expect, it } from "vitest";
import { extractKeywordsFallback } from "@/lib/ollama";
import { escapeLatex, renderResumeLatex } from "@/lib/renderLatex";
import { applyResumeEdits } from "@/lib/resumeEdit";
import { runQA } from "@/lib/resumeQA";
import type { ResumeProfile } from "@/types/profile";

const sampleProfile: ResumeProfile = {
  header: {
    name: "Sadikul Saber",
    phone: "555-555-5555",
    email: "sadikul@example.com",
    linkedin: "linkedin.com/in/sadikul",
    github: "github.com/ss889",
  },
  education: [
    {
      school: "NJIT",
      location: "Newark, NJ",
      degree: "B.S. Computer Science",
      dates: "May 2026",
    },
  ],
  skills: [
    {
      category: "Languages",
      items: ["TypeScript", "Python"],
    },
  ],
  projects: [
    {
      id: "agentic-blog",
      title: "Agentic Blog Platform",
      tags: "Next.js, Claude API",
      status: "2026",
      bullets: ["Built MCP workflows for content editing.", "Integrated Claude API for revision planning."],
    },
  ],
  experience: [
    {
      id: "research-assistant",
      title: "Research Assistant",
      company: "NJIT",
      location: "Newark, NJ",
      dates: "2025",
      bullets: ["Developed Python scripts for dataset cleanup.", "Shipped TypeScript dashboards for analysis."],
    },
  ],
};

describe("resume tailoring helpers", () => {
  it("flags deterministic QA issues", () => {
    const profile: ResumeProfile = {
      ...sampleProfile,
      projects: [
        {
          ...sampleProfile.projects[0],
          bullets: [
            "Built robust workflows \u2014 with repeated phrasing.",
            "Built TypeScript tooling.",
            "Built Python automation.",
          ],
        },
      ],
    };

    const issues = runQA(profile, ["TypeScript", "Python", "LangChain", "RAG"]);
    expect(issues.some((issue) => issue.type === "em_dash")).toBe(true);
    expect(issues.some((issue) => issue.type === "generic_phrase")).toBe(true);
    expect(issues.some((issue) => issue.type === "repeated_verb")).toBe(true);
  });

  it("returns no QA issues for a clean keyword-covered profile", () => {
    const issues = runQA(sampleProfile, ["TypeScript", "Python", "Claude API"]);
    expect(issues).toEqual([]);
  });

  it("extracts fallback keywords without Ollama", () => {
    const keywords = extractKeywordsFallback(
      "We need a TypeScript AI Engineer building RAG workflows with LangChain, Python, and Claude API."
    );

    expect(keywords.join(" ").toLowerCase()).toContain("typescript");
    expect(keywords.length).toBeLessThanOrEqual(15);
  });

  it("escapes LaTeX special characters", () => {
    expect(escapeLatex("Built 20% faster R&D tools with $0 budget & TypeScript")).toContain("\\%");
    expect(escapeLatex("Built 20% faster R&D tools with $0 budget & TypeScript")).toContain("\\$");
    expect(escapeLatex("Built 20% faster R&D tools with $0 budget & TypeScript")).toContain("\\&");
  });

  it("renders a compilable resume skeleton", () => {
    const latex = renderResumeLatex(sampleProfile);
    expect(latex).toContain("\\documentclass");
    expect(latex).toContain("\\section{Projects}");
    expect(latex).toContain("\\newcommand{\\resumeItemListStart}{\\begin{itemize}[label={\\textbullet}]}");
    expect(latex).toContain("\\resumeItem{Built MCP workflows for content editing.}");
  });

  it("applies refinement edits only to targeted bullets", () => {
    const updated = applyResumeEdits(sampleProfile, [
      {
        location: "project:agentic-blog",
        bullet_index: 1,
        new_text: "Improved Claude API revision planning for tailored content workflows.",
      },
    ]);

    expect(updated.projects[0].bullets[0]).toBe(sampleProfile.projects[0].bullets[0]);
    expect(updated.projects[0].bullets[1]).toBe(
      "Improved Claude API revision planning for tailored content workflows."
    );
    expect(updated.experience[0].bullets).toEqual(sampleProfile.experience[0].bullets);
  });
});
