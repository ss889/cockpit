# JobOps AI

JobOps AI is a local-first career workspace for managing job descriptions, tailoring LaTeX resumes, and preparing for interviews with AI assistance.

The app is built for a personal job-search workflow: paste or import a job description, save it to a local workspace, generate an ATS-friendly tailored resume, and create an interview prep packet grounded in your resume and saved career notes.

## What It Does

- Saves job descriptions with inferred title and company.
- Generates tailored LaTeX resume drafts from a saved base resume profile.
- Keeps resume output ATS-friendly with simple sections and bullet lists.
- Runs deterministic resume QA for issues like fake metrics, AI-sounding phrases, dash punctuation, weak bullet structure, and unsupported claims.
- Creates interview prep packets for saved jobs, including likely questions, talking points, gap briefs, and story prompts.
- Stores local workspace data in `data/local-workspace.json` when running on your machine.
- Exposes a read-only local MCP server for MCP-capable clients.
- Includes deterministic evals for resume quality, ATS output, JD metadata, and interview prep exports.

## Tech Stack

- Next.js App Router
- React
- TypeScript
- Anthropic SDK
- Vitest
- File-backed local persistence
- Read-only stdio MCP server

## Quickstart

Prerequisites:

- Node.js 18+
- npm
- Anthropic API key

```bash
git clone https://github.com/ss889/cockpit.git
cd cockpit
npm install
cp .env.local.example .env.local
```

Add your Anthropic key to `.env.local`:

```bash
ANTHROPIC_API_KEY=your_key_here
ANTHROPIC_MODEL=claude-haiku-4-5
```

Run locally:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Main Workflow

1. Open the app and sign into the local workspace.
2. Paste a job description.
3. Save the JD.
4. Set your base LaTeX resume in the Tailor Resume panel.
5. Generate a tailored `.tex` resume for a saved job.
6. Generate interview prep for the same job.
7. Download the resume or prep packet when ready.

Job links can be imported when the source allows server-side fetching. Some boards, including large job aggregators, may block automated fetches, so copy-pasting the JD is the most reliable path.

## Scripts

```bash
npm run dev              # Start the local dev server
npm run build            # Build for production
npm start                # Start the production server
npm test -- --run        # Run the test suite once
npm run evals            # Run deterministic quality evals
npm run mcp:self-test    # Validate the local MCP server
npm run mcp:jobops       # Start the read-only MCP server over stdio
```

## Evals

The eval suite lives in `tests/evals` and checks:

- Clean tailored resume profiles pass deterministic QA.
- Rendered LaTeX remains ATS-friendly.
- JD title and company inference works on fixture descriptions.
- Interview prep exports as clean markdown.

Run it with:

```bash
npm run evals
```

## Local MCP

The MCP server is read-only and exposes saved workspace data from `data/local-workspace.json`.

Available tools:

- `jobops_workspace_summary`
- `jobops_list_saved_jobs`
- `jobops_get_saved_job`
- `jobops_get_base_resume_profile`
- `jobops_export_job_packet`

More details are in `DOCS/EVALS_AND_MCP.md`.

## Project Structure

```text
app/                  Next.js pages and API routes
components/           Reusable UI components
lib/                  Resume rendering, QA, metadata parsing, local workspace helpers
scripts/              Worker and MCP scripts
tests/                Unit tests and evals
types/                Shared TypeScript types
DOCS/                 Supporting documentation
```

## Deployment Notes

The app can deploy to Vercel or any Node-capable host, but the richest workflow is local because workspace data is file-backed. For hosted deployment, configure `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` in the platform environment.

## License

MIT
