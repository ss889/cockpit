# AI Career Cockpit

AI Career Cockpit is a full-stack example application that analyzes job descriptions and provides structured, actionable guidance to help candidates understand role requirements, identify skill gaps, and receive targeted project suggestions to improve fit.

This README focuses on what the project does, how it works, and how to run it locally or deploy it.

## Key Features

- Parse job descriptions into structured fields (title, responsibilities, required skills, seniority).
- Analyze skill gaps against a user profile and compute a fit score.
- Suggest focused projects that help close identified gaps, with difficulty and learning outcomes.
- Context-aware follow-up chat allowing users to ask specific questions about the role or recommendations.
- Server-side API integration so API keys remain secure (no secrets in the browser).

## How It Works (High Level)

1. User pastes or uploads a job description.
2. Server runs a small pipeline of structured tool calls that:
   - Parse the job description into a typed schema.
   - Compare parsed requirements to a candidate profile to compute fit.
   - Produce a small set of project suggestions targeted to bridge gaps.
3. Results are returned to the frontend as typed objects and displayed in a three-panel layout (parsed role, gap analysis, suggested projects).
4. The user can follow up via the chat interface which uses the same server-side context to answer questions.

## Tech Stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Anthropic SDK (server-side for chat/tooling)
- SQLite (`better-sqlite3`) for local persistence when enabled

## Quickstart

Prerequisites:
- Node.js 18+ and npm
- ANTHROPIC_API_KEY (set in `.env.local`)

Install and run locally:

```bash
git clone https://github.com/ss889/ai-career-cockpit.git
cd ai-career-cockpit
npm install
cp .env.local.example .env.local
# Edit .env.local and add your ANTHROPIC_API_KEY
npm run dev
```

Open http://localhost:3000 in your browser.

Optional: build and run via Docker

```bash
docker build -t ai-career-cockpit:latest .
docker run --rm --name ai-career-cockpit -p 3000:3000 \
  -e "ANTHROPIC_API_KEY=..." -v $(pwd)/data:/app/data ai-career-cockpit:latest
```

Notes:
- The service uses `data/corpus.db` when SQLite is enabled; mounting `./data` keeps your state between runs.
- Use `/api/corpus` to add job descriptions and `POST /api/jobs/analyze` to run analysis via the API.

## Project Structure

```
.
├── app/                       # Next.js app router pages and API routes
├── components/                # UI components (JD input, analysis panels, chat)
├── lib/                       # Tool definitions, API helpers, and analysis logic
├── types/                     # Shared TypeScript interfaces
├── tests/                     # Unit and integration tests
```

## Tests

Run the test suite with:

```bash
npm test
```

Tests cover tool schema validation, parsing logic, and result handling.

## Deployment

Deploy to Vercel or another Node-capable host. Ensure environment variables (at minimum `ANTHROPIC_API_KEY`) are configured in the target environment.

## Development Commands

- `npm run dev` — Start development server
- `npm run build` — Build for production
- `npm start` — Start production server
- `npm run lint` — Run ESLint

## Troubleshooting & Notes

- If you see Anthropic model 404s, set `ANTHROPIC_MODEL` in your environment to a supported model id and restart the server.
- The project uses server-side tool calling patterns; check `lib/tools.ts` and `lib/analyze.ts` for the analysis pipeline implementation.

## License

MIT

