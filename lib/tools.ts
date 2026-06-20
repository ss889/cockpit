import type Anthropic from "@anthropic-ai/sdk";
import {
  ParseJobDescriptionOutput,
  AnalyzeSkillGapOutput,
  SuggestProjectsOutput,
  AnalysisResult,
} from "@/types";

export const tools: Anthropic.Messages.ToolUnion[] = [
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

export const extractProfileTool = {
  name: "extract_resume_profile",
  description: "Parse a LaTeX resume into a structured JSON profile",
  input_schema: {
    type: "object" as const,
    properties: {
      header: {
        type: "object",
        properties: {
          name: { type: "string" },
          phone: { type: "string" },
          email: { type: "string" },
          linkedin: { type: "string" },
          github: { type: "string" },
        },
        required: ["name", "phone", "email", "linkedin", "github"],
      },
      education: {
        type: "array",
        items: {
          type: "object",
          properties: {
            school: { type: "string" },
            location: { type: "string" },
            degree: { type: "string" },
            dates: { type: "string" },
          },
          required: ["school", "location", "degree", "dates"],
        },
      },
      skills: {
        type: "array",
        items: {
          type: "object",
          properties: {
            category: { type: "string" },
            items: { type: "array", items: { type: "string" } },
          },
          required: ["category", "items"],
        },
      },
      projects: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            tags: { type: "string" },
            status: { type: "string" },
            bullets: { type: "array", items: { type: "string" } },
          },
          required: ["id", "title", "tags", "status", "bullets"],
        },
      },
      experience: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            company: { type: "string" },
            location: { type: "string" },
            dates: { type: "string" },
            bullets: { type: "array", items: { type: "string" } },
          },
          required: ["id", "title", "company", "location", "dates", "bullets"],
        },
      },
    },
    required: ["header", "education", "skills", "projects", "experience"],
  },
};

export const tailorResumeTool = {
  name: "tailor_resume",
  description: "Rewrite resume bullets and select relevant projects to match a job description",
  input_schema: {
    type: "object" as const,
    properties: {
      selected_project_ids: { type: "array", items: { type: "string" } },
      rewritten_projects: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            bullets: { type: "array", items: { type: "string" } },
          },
          required: ["id", "bullets"],
        },
      },
      rewritten_experience: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            bullets: { type: "array", items: { type: "string" } },
          },
          required: ["id", "bullets"],
        },
      },
      updated_skills: {
        type: "array",
        items: {
          type: "object",
          properties: {
            category: { type: "string" },
            items: { type: "array", items: { type: "string" } },
          },
          required: ["category", "items"],
        },
      },
    },
    required: ["selected_project_ids", "rewritten_projects", "rewritten_experience", "updated_skills"],
  },
};

export const reviseResumeBulletsTool = {
  name: "revise_resume_bullets",
  description: "Fix only flagged resume bullets without changing the underlying facts",
  input_schema: {
    type: "object" as const,
    properties: {
      revisions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            location: { type: "string" },
            bullet: { type: "string" },
          },
          required: ["location", "bullet"],
        },
      },
    },
    required: ["revisions"],
  },
};

export const editResumeTool = {
  name: "edit_resume_section",
  description: "Make a targeted edit to a specific bullet or section based on the user's request",
  input_schema: {
    type: "object" as const,
    properties: {
      explanation: {
        type: "string",
        description: "One or two sentences explaining what changed and why, written conversationally",
      },
      edits: {
        type: "array",
        items: {
          type: "object",
          properties: {
            location: {
              type: "string",
              description: "Format: project:<id> or experience:<id>",
            },
            bullet_index: {
              type: "number",
              description: "Index of the bullet being changed",
            },
            new_text: { type: "string" },
          },
          required: ["location", "bullet_index", "new_text"],
        },
      },
    },
    required: ["explanation", "edits"],
  },
};

export function parseToolResults(
  content: unknown[]
): AnalysisResult {
  const result: AnalysisResult = {
    parsed: null,
    gap: null,
    projects: null,
  };

  for (const block of content) {
    if (isToolUseBlock(block)) {
      const input = block.input;

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

function isToolUseBlock(block: unknown): block is { type: "tool_use"; name: string; input: Record<string, unknown> } {
  return (
    typeof block === "object" &&
    block !== null &&
    "type" in block &&
    "name" in block &&
    "input" in block &&
    block.type === "tool_use" &&
    typeof block.name === "string" &&
    typeof block.input === "object" &&
    block.input !== null
  );
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
