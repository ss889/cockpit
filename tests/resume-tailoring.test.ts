import { describe, expect, it } from "vitest";
import { renderInterviewPrepMarkdown } from "@/lib/interviewPrep";
import { extractKeywordsFallback } from "@/lib/ollama";
import { escapeLatex, renderResumeLatex } from "@/lib/renderLatex";
import { applyResumeEdits, sanitizeBullet } from "@/lib/resumeEdit";
import { runQA } from "@/lib/resumeQA";
import type { ResumeProfile } from "@/types/profile";
import type { InterviewPrepPacket } from "@/types/workspace";

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
      bullets: [
        "Cleaned 500 rows of dataset exports using Python validation scripts.",
        "Shipped 3 TypeScript dashboard views with reusable chart components.",
      ],
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
            "Leveraged a scalable solution with a focus on seamless collaboration across multiple dynamic stakeholders and fast-paced business priorities while supporting cross-functional execution across changing implementation requirements, documentation reviews, deployment planning, validation work, and ongoing stakeholder updates.",
          ],
        },
      ],
    };

    const issues = runQA(profile, ["TypeScript", "Python", "LangChain", "RAG"]);
    expect(issues.some((issue) => issue.type === "dash_punctuation")).toBe(true);
    expect(issues.some((issue) => issue.type === "formulaic_phrase")).toBe(true);
    expect(issues.some((issue) => issue.type === "repeated_verb")).toBe(true);
    expect(issues.some((issue) => issue.type === "long_bullet")).toBe(true);
  });

  it("flags experience bullets that do not follow an XYZ shape", () => {
    const profile: ResumeProfile = {
      ...sampleProfile,
      experience: [
        {
          ...sampleProfile.experience[0],
          bullets: ["Worked on dashboards for analysis."],
        },
      ],
    };

    const issues = runQA(profile, ["TypeScript"]);
    expect(issues.some((issue) => issue.type === "weak_xyz_formula")).toBe(true);
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

  it("sanitizes dash punctuation from generated bullets", () => {
    expect(sanitizeBullet("Built workflows \u2014 tested outputs - shipped updates")).toBe(
      "Built workflows, tested outputs, shipped updates"
    );
  });

  it("renders a compilable resume skeleton", () => {
    const latex = renderResumeLatex(sampleProfile);
    expect(latex).toContain("\\documentclass");
    expect(latex).toContain("\\section{Projects}");
    expect(latex).toContain("\\newcommand{\\resumeItemListStart}{\\begin{itemize}[label={\\textbullet}]}");
    expect(latex).toContain("\\resumeItem{Built MCP workflows for content editing.}");
    expect(latex).not.toContain("\\begin{tabular");
    expect(latex).not.toContain("\\usepackage{tabularx}");
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

  it("renders interview prep packets as portable markdown", () => {
    const prep: InterviewPrepPacket = {
      generatedAt: "2026-07-13T12:00:00.000Z",
      roleSummary: "This role values practical AI product work.",
      likelyScreenQuestions: ["Tell me about your AI projects."],
      technicalQuestions: ["How would you evaluate an LLM workflow?"],
      behavioralQuestions: ["Tell me about a time you handled ambiguity."],
      talkingPoints: ["Connect JobOps AI to the role."],
      gapBrief: ["Be honest about TensorFlow depth."],
      tellMeAboutYourself: "I build applied AI tools with TypeScript and Python.",
      whyThisRole: "This role matches my interest in applied AI systems.",
      stories: [
        {
          prompt: "Debugging story",
          answerOutline: "Situation, action, result from JobOps AI.",
          resumeEvidence: "JobOps AI and Claude API pipeline work.",
        },
      ],
    };

    const markdown = renderInterviewPrepMarkdown("AI Engineer Intern", "The Muse", prep);
    expect(markdown).toContain("# Interview Prep: AI Engineer Intern at The Muse");
    expect(markdown).toContain("## Technical Questions");
    expect(markdown).toContain("- How would you evaluate an LLM workflow?");
    expect(markdown).toContain("### Story 1: Debugging story");
  });
});
