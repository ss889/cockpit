#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const projectRoot = process.cwd();
const workspaceFile = process.env.JOBOPS_WORKSPACE_FILE || path.join(projectRoot, "data", "local-workspace.json");

const tools = [
  {
    name: "jobops_workspace_summary",
    description: "Return counts and high-level state from the local JobOps workspace",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "jobops_list_saved_jobs",
    description: "List saved job descriptions with their tailoring and interview-prep status",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of jobs to return",
          minimum: 1,
          maximum: 50,
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "jobops_get_saved_job",
    description: "Return one saved job description by id",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Saved job id",
        },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "jobops_get_base_resume_profile",
    description: "Return the saved base resume profile, if one exists",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "jobops_export_job_packet",
    description: "Return a combined packet for one saved job, including JD text, tailored LaTeX, and interview prep when available",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Saved job id",
        },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
];

export function readWorkspace(filePath = workspaceFile) {
  try {
    if (!fs.existsSync(filePath)) return emptyWorkspace();
    return normalizeWorkspace(JSON.parse(fs.readFileSync(filePath, "utf8") || "{}"));
  } catch {
    return emptyWorkspace();
  }
}

export function handleRequest(message, filePath = workspaceFile) {
  if (!message || typeof message !== "object") return null;
  if (!("id" in message)) return null;

  try {
    switch (message.method) {
      case "initialize":
        return result(message.id, {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {},
            resources: {},
          },
          serverInfo: {
            name: "jobops-local-workspace",
            version: "0.1.0",
          },
        });
      case "tools/list":
        return result(message.id, { tools });
      case "tools/call":
        return result(message.id, callTool(message.params || {}, filePath));
      case "resources/list":
        return result(message.id, {
          resources: [
            {
              uri: "jobops://workspace/local",
              name: "Local JobOps Workspace",
              description: "Local workspace data from data/local-workspace.json",
              mimeType: "application/json",
            },
          ],
        });
      case "resources/read":
        return result(message.id, readResource(message.params || {}, filePath));
      default:
        return error(message.id, -32601, `Method not found: ${message.method}`);
    }
  } catch (err) {
    return error(message.id, -32000, err instanceof Error ? err.message : "MCP server error");
  }
}

function callTool(params, filePath) {
  const name = params.name;
  const args = params.arguments || {};
  const workspace = readWorkspace(filePath);

  switch (name) {
    case "jobops_workspace_summary":
      return textResult({
        updatedAt: workspace.updatedAt,
        signedInAs: workspace.session ? { name: workspace.session.name, role: workspace.session.role } : null,
        counts: {
          memories: workspace.memories.length,
          jobDescriptions: workspace.jobDescriptions.length,
          tailoredResumes: workspace.jobDescriptions.filter((job) => Boolean(job.tailoredLatex)).length,
          interviewPrepPackets: workspace.jobDescriptions.filter((job) => Boolean(job.interviewPrep)).length,
        },
        hasBaseResumeProfile: Boolean(workspace.baseResumeProfile),
      });
    case "jobops_list_saved_jobs":
      return textResult(
        workspace.jobDescriptions.slice(0, clampLimit(args.limit)).map((job) => summarizeJob(job))
      );
    case "jobops_get_saved_job":
      return textResult(requireJob(workspace, args.id));
    case "jobops_get_base_resume_profile":
      return textResult(workspace.baseResumeProfile || { message: "No base resume profile saved." });
    case "jobops_export_job_packet": {
      const job = requireJob(workspace, args.id);
      return textResult({
        job,
        tailoredLatex: job.tailoredLatex || null,
        interviewPrep: job.interviewPrep || null,
      });
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function readResource(params, filePath) {
  if (params.uri !== "jobops://workspace/local") {
    throw new Error(`Unknown resource: ${params.uri}`);
  }

  return {
    contents: [
      {
        uri: "jobops://workspace/local",
        mimeType: "application/json",
        text: JSON.stringify(readWorkspace(filePath), null, 2),
      },
    ],
  };
}

function emptyWorkspace() {
  return {
    session: null,
    memories: [],
    jobDescriptions: [],
    baseResumeProfile: null,
    updatedAt: null,
  };
}

function normalizeWorkspace(value) {
  return {
    session: value?.session || null,
    memories: Array.isArray(value?.memories) ? value.memories : [],
    jobDescriptions: Array.isArray(value?.jobDescriptions) ? value.jobDescriptions : [],
    baseResumeProfile: value?.baseResumeProfile || null,
    updatedAt: value?.updatedAt || null,
  };
}

function summarizeJob(job) {
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    url: job.url || null,
    status: job.status || "saved",
    prepStatus: job.prepStatus || (job.interviewPrep ? "ready" : "idle"),
    hasTailoredLatex: Boolean(job.tailoredLatex),
    hasInterviewPrep: Boolean(job.interviewPrep),
    createdAt: job.createdAt,
  };
}

function requireJob(workspace, id) {
  if (typeof id !== "string" || !id.trim()) throw new Error("Tool argument id is required");
  const job = workspace.jobDescriptions.find((item) => item.id === id);
  if (!job) throw new Error(`Saved job not found: ${id}`);
  return job;
}

function clampLimit(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 20;
  return Math.min(50, Math.max(1, Math.floor(value)));
}

function textResult(value) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

function result(id, value) {
  return {
    jsonrpc: "2.0",
    id,
    result: value,
  };
}

function error(id, code, message) {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
    },
  };
}

async function runStdioServer() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const response = handleRequest(JSON.parse(trimmed));
      if (response) process.stdout.write(`${JSON.stringify(response)}\n`);
    } catch (err) {
      process.stdout.write(
        `${JSON.stringify(error(null, -32700, err instanceof Error ? err.message : "Parse error"))}\n`
      );
    }
  }
}

function runSelfTest() {
  const tempDir = fs.mkdtempSync(path.join(process.cwd(), ".tmp-mcp-"));
  const tempFile = path.join(tempDir, "workspace.json");
  fs.writeFileSync(
    tempFile,
    JSON.stringify({
      session: { name: "self-test", role: "owner", signedInAt: "2026-07-16T00:00:00.000Z" },
      memories: [],
      jobDescriptions: [
        {
          id: "jd-self-test",
          title: "AI Engineer Intern",
          company: "Example AI",
          text: "Build AI features",
          createdAt: "2026-07-16T00:00:00.000Z",
          status: "saved",
        },
      ],
      baseResumeProfile: null,
      updatedAt: "2026-07-16T00:00:00.000Z",
    })
  );

  const initialize = handleRequest({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }, tempFile);
  const list = handleRequest({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }, tempFile);
  const summary = handleRequest(
    { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "jobops_workspace_summary", arguments: {} } },
    tempFile
  );
  const job = handleRequest(
    { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "jobops_get_saved_job", arguments: { id: "jd-self-test" } } },
    tempFile
  );

  fs.rmSync(tempDir, { recursive: true, force: true });

  if (!initialize?.result || !list?.result?.tools?.length || !summary?.result?.content?.[0]?.text || !job?.result?.content?.[0]?.text) {
    throw new Error("MCP self-test failed");
  }

  process.stdout.write("MCP self-test passed\n");
}

const isMain = path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url);

if (process.argv.includes("--self-test")) {
  runSelfTest();
} else if (isMain) {
  runStdioServer();
}
