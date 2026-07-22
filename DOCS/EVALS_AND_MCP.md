# Evals and Local MCP

This project has two local quality and tooling layers:

- Evals protect resume, ATS, job metadata, and interview-prep behavior.
- The local MCP server exposes saved workspace data to MCP-capable clients.

## Evals

Run the eval suite:

```bash
npm run evals
```

The evals live in `tests/evals` and currently check:

- Clean resume profiles pass deterministic QA gates.
- Rendered LaTeX stays ATS-friendly with simple sections and bullet lists.
- Pasted job descriptions infer title and company correctly.
- Interview prep exports as portable markdown without broken placeholders.

These evals are deterministic. They do not call Anthropic and do not spend API credits.

## Local MCP Server

Run a self-test:

```bash
npm run mcp:self-test
```

Start the MCP server over stdio:

```bash
npm run mcp:jobops
```

The server reads `data/local-workspace.json` by default. You can point it at another workspace file:

```bash
$env:JOBOPS_WORKSPACE_FILE="C:\path\to\local-workspace.json"
npm run mcp:jobops
```

Available tools:

- `jobops_workspace_summary`
- `jobops_list_saved_jobs`
- `jobops_get_saved_job`
- `jobops_get_base_resume_profile`
- `jobops_export_job_packet`

Available resources:

- `jobops://workspace/local`

The MCP server is read-only. It does not modify workspace data and does not expose environment variables or API keys.
