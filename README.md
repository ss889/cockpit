# AI Career Cockpit

Development notes and deployment instructions.

Environment
- `ANTHROPIC_API_KEY` — required for Anthropic API usage.
- `OPENAI_API_KEY` — optional, required for embeddings (OpenAI).

Worker
- See DOCS/WORKER.md for production worker startup and environment details.

Docker (build & run)

Build image:

```bash
docker build -t ai-career-cockpit:latest .
```

Run (persist `data/`):

```bash
docker run --rm --name ai-career-cockpit -p 3000:3000 \
  -e "ANTHROPIC_API_KEY=..." -e "OPENAI_API_KEY=..." \
  -v $(pwd)/data:/app/data \
  ai-career-cockpit:latest
```

Notes
- The app uses SQLite (`better-sqlite3`) when available; `data/corpus.db` will be stored in the `data/` directory.
- Use `/api/corpus` to add job descriptions and `/api/analyze` to run analysis (includes RAG automatically).
- Trigger embedding backfill (computes embeddings for existing docs) via `POST /api/jobs/backfill`.
# AI Career Intelligence Cockpit

## What This Is

**AI Career Intelligence Cockpit** is a production-grade full-stack application that demonstrates structured tool calling with Claude API and multi-step agentic workflows. It analyzes any job description through three Claude tools—parsing the role requirements, analyzing skill gaps against your profile, and suggesting targeted projects to close those gaps. Built with Next.js 14, TypeScript, Tailwind CSS, and the Anthropic SDK, it's a real-world example of how to integrate Claude's function calling capabilities into a modern web application.

## Why I Built It

As a CS student at NJIT graduating May 2026, I recognized that while I understand conceptually what AI engineers should do (leverage structured tool calling, implement multi-step workflows, design systems that orchestrate multiple API calls), there was a gap between theory and production implementation. This project bridges that gap by building a complete, spec-driven application that solves a real problem (career development) while demonstrating these underrepresented skills.

Most portfolios show single-API-call patterns or simple fetch/display logic. This cockpit shows the **operational complexity** of real AI systems: defining precise tool schemas, parsing structured outputs from Claude, maintaining context across multiple agentic steps, handling errors gracefully, and building a polished UI that makes the AI work transparent to the user.

## Skills Demonstrated

- **Structured Tool Calling**: Defined three Claude tools with precise JSON schemas (parse_job_description, analyze_skill_gap, suggest_projects), executed them in sequence, and parsed the structured outputs
- **Multi-Step Agentic Workflows**: Orchestrated a three-step pipeline where each tool's output informs the next step's context
- **API Design & Integration**: Built a production server-side `/api/analyze` route that securely manages API keys, validates requests, and returns both initial tool results and follow-up chat responses
- **Full-Stack TypeScript**: Enforced type safety across frontend components, API routes, and tool definitions using 8 TypeScript interfaces
- **React State Management**: Implemented complex state handling for analysis results, chat history, saved roles, and error states across multiple components
- **Responsive UI/UX**: Built a two-column desktop layout and mobile-responsive single-column view with proper loading states, error displays, and localStorage persistence

## Setup

### Prerequisites
- Node.js 18+ and npm
- Anthropic API key ([get one free](https://console.anthropic.com))

### Installation

```bash
# Clone and navigate
git clone https://github.com/ss889/ai-career-cockpit.git
cd ai-career-cockpit

# Install dependencies
npm install

# Set up environment
cp .env.local.example .env.local
# Edit .env.local and add your ANTHROPIC_API_KEY
```

### Running Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Running Tests

This project includes comprehensive tests for tool definitions and result parsing:

```bash
npm test
```

Tests cover:
- Tool schema validation (required fields, enums, constraints)
- Tool result parsing (extraction of job description, gap analysis, and project suggestions)
- Error handling for missing or malformed tool outputs
- Multi-tool batch processing

## Live Demo

**Coming soon on Vercel** — Full live deployment will be available at a production URL for demonstration purposes. The app requires an ANTHROPIC_API_KEY in environment variables to function.

---

### How It Works

1. **Paste a Job Description** → User provides raw job posting text in the left sidebar
2. **Initial Analysis** → Three Claude tools run in parallel:
   - `parse_job_description`: Extracts job title, company, role type, responsibilities, required/preferred skills, seniority
   - `analyze_skill_gap`: Maps parsed requirements against your profile, computes fit_score (0-100), assigns fit_label (Strong Fit / Developing Fit / Early Stage)
   - `suggest_projects`: Recommends exactly 2 projects that close identified gaps with difficulty levels and learning outcomes
3. **View Results** → Three card layout displays parsed role, gap analysis with color-coded skills (green=matching, orange=gap), and suggested projects
4. **Follow-up Chat** → Ask context-aware questions ("Why is Docker important for this role?") using chat history and full JD as context
5. **Save Roles** → Store analyzed roles in localStorage for quick reference

### Technical Highlights

- **Server-Side Claude Integration**: All API calls happen on the server (`/api/analyze`) — your API key never reaches the browser
- **Tool Schema as Single Source of Truth**: All three tools defined once in `lib/tools.ts` with full input/output schemas
- **Type-Safe Parsing**: `parseToolResults()` function extracts typed outputs from Claude's content array
- **Dark Operator Theme**: Zinc-950 background, indigo-600 primary accent, color-coded pills for visual hierarchy
- **localStorage Persistence**: Saved roles survive browser refresh with structure `{ id, title, jd, savedAt }`

### Project Structure

```
.
├── app/
│   ├── page.tsx                 # Main layout with state management
│   └── api/
│       └── analyze/route.ts     # Claude API integration
├── components/
│   ├── JDInput.tsx              # Left sidebar: input + saved roles
│   ├── AnalysisPanel.tsx        # Three result cards
│   └── ChatPanel.tsx            # Chat interface
├── lib/
│   └── tools.ts                 # Tool definitions, parsing logic, system prompt
├── types/
│   └── index.ts                 # 8 TypeScript interfaces (single source of truth)
├── tests/
│   ├── tools.test.ts            # Tool schema validation
│   └── parsing.test.ts          # Result parsing tests
└── vitest.config.ts             # Test configuration
```

---

**Built by Sadikul Saber** • Graduating May 2026 • [GitHub](https://github.com/ss889) • [Deployed on Vercel]()

Deploy to Vercel with a single click:

```bash
vercel deploy
```

Make sure to set the `ANTHROPIC_API_KEY` environment variable in Vercel's settings.

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## Smoke Test

With the app running locally, verify deferred job scheduling with:

```bash
npm run smoke:defer
```

Set `SMOKE_BASE_URL` if the app is not on `http://localhost:3000`.

## License

MIT

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
