import type * as Anthropic from "@anthropic-ai/sdk";
import {
  ParseJobDescriptionOutput,
  AnalyzeSkillGapOutput,
  SuggestProjectsOutput,
  AnalysisResult,
} from "@/types";

export const tools: any[] = [
  {
    name: "parse_job_description",
    description: "Extract structured role information from a job description",
    input_schema: {
      type: "object" as const,
      properties: {
        job_title: { type: "string" },
        company: { type: "string" },
        role_type: {
          type: "string",
          enum: ["FDE", "AI Engineer", "AI Product Engineer", "Other"],
        },
        top_responsibilities: {
          type: "array",
          items: { type: "string" },
          description: "Top 3 responsibilities only",
          maxItems: 3,
        },
        required_skills: {
          type: "array",
          items: { type: "string" },
        },
        preferred_skills: {
          type: "array",
          items: { type: "string" },
        },
        seniority: {
          type: "string",
          enum: ["Junior", "Mid", "Senior", "Not specified"],
        },
      },
      required: [
        "job_title",
        "company",
        "role_type",
        "top_responsibilities",
        "required_skills",
        "seniority",
      ],
    },
  },
  {
    name: "analyze_skill_gap",
    description:
      "Compare job requirements against the developer profile and return a gap analysis",
    input_schema: {
      type: "object" as const,
      properties: {
        matching_skills: {
          type: "array",
          items: { type: "string" },
        },
        gap_skills: {
          type: "array",
          items: { type: "string" },
        },
        gap_summary: {
          type: "string",
          description: "2 sentences max. Be honest and direct.",
        },
        fit_score: {
          type: "number",
          description: "0 to 100. Do not inflate.",
          minimum: 0,
          maximum: 100,
        },
        fit_label: {
          type: "string",
          enum: ["Strong Fit", "Developing Fit", "Early Stage"],
        },
      },
      required: [
        "matching_skills",
        "gap_skills",
        "gap_summary",
        "fit_score",
        "fit_label",
      ],
    },
  },
  {
    name: "suggest_projects",
    description: "Suggest two realistic projects to address the top skill gaps",
    input_schema: {
      type: "object" as const,
      properties: {
        projects: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: {
                type: "string",
                description: "2 sentences max",
              },
              skills_addressed: { type: "array", items: { type: "string" } },
              difficulty: {
                type: "string",
                enum: ["Weekend", "1 Week", "1 Month"],
              },
              why_it_matters: {
                type: "string",
                description: "1 sentence",
              },
            },
            required: [
              "title",
              "description",
              "skills_addressed",
              "difficulty",
              "why_it_matters",
            ],
          },
          minItems: 2,
          maxItems: 2,
        },
      },
      required: ["projects"],
    },
  },
];

export function parseToolResults(
  content: any[]
): AnalysisResult {
  const result: AnalysisResult = {
    parsed: null,
    gap: null,
    projects: null,
  };

  for (const block of content) {
    if (block.type === "tool_use") {
      const input = block.input as Record<string, unknown>;

      switch (block.name) {
        case "parse_job_description":
          result.parsed = input as unknown as ParseJobDescriptionOutput;
          break;
        case "analyze_skill_gap":
          result.gap = input as unknown as AnalyzeSkillGapOutput;
          break;
        case "suggest_projects":
          result.projects = input as unknown as SuggestProjectsOutput;
          break;
      }
    }
  }

  return result;
}

export const SYSTEM_PROMPT = `You are a career intelligence assistant for Sadikul Saber, a CS student at NJIT graduating May 2026.

Developer profile:
- Skills: Prompt Engineering, MCP (Model Context Protocol), Agentic Workflows, RAG, Claude API, LangChain, Groq API, TypeScript, Python, React, Next.js, Docker, GitHub Actions
- Tools: Cursor, Windsurf, Claude Desktop, VS Code Copilot
- Projects: Agentic Blog Platform (MCP + Claude API), Research Assistant Chatbot (LangChain + Groq), AI Funding Data Scraper (Python + SQLite + Docker), Company Intelligence Platform (Claude API + React)
- Strengths: AI tooling, agentic workflows, spec-based development, building fast
- Gaps: enterprise system integrations, production observability, LangGraph, voice channel AI
- Target roles: Forward Deployed Engineer, AI Product Engineer, Applied AI Engineer

When analyzing job descriptions, call all three tools in sequence: parse_job_description first, then analyze_skill_gap, then suggest_projects. Be direct and honest. Do not inflate fit scores.`;
