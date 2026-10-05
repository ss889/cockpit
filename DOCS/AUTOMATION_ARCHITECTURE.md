# JobOps AI Automation Architecture

## Sprint 0 Audit

Date: 2026-09-28

This document records the current repository state, the insertion points for the
automation roadmap, and the completed Sprint 1-8 ingestion slices. Later
sprints remain intentionally unimplemented.

## Sprint 3 Implementation
`lib/localIngestion.ts` now applies deterministic deduplication in this order:

1. Same-source external ID.
2. Canonical URL after removing fragments, tracking parameters, default ports,
   and trailing path slashes.
3. Normalized source URL.
4. Normalized company plus title.
5. Same-company text similarity as a review signal.

External IDs are optional and source-scoped. Existing records without the new
fields remain valid. Strong matches return `duplicate` and reuse the existing
job without creating another job record. A same-company, high-overlap capture
`ingestionStatus: "needs_review"`, `duplicateOf`, and
`deduplicationReason: "text_similarity"`; it is never silently merged.

The ingestion response now supports `created`, `duplicate`, and `needs_review`.
The original capture is preserved for all three outcomes.

## Sprint 1 Implementation

The local ingestion contract is implemented at
`app/api/local/ingest/page/route.ts` and delegates to
`lib/localIngestion.ts`:

- Requires `Authorization: Bearer $JOBOPS_LOCAL_TOKEN`.
- Rejects missing configuration, missing credentials, and incorrect tokens with
  `401`.
- Validates HTTP(S) URL, matching source hostname, capture timestamp, bounded
  title fields, and non-empty visible text.
- Normalizes URL identity by lowercasing the hostname, removing fragments, and
  removing default ports.
- Preserves every raw capture in `LocalWorkspace.sourceCaptures`.
- Creates a compatible `JobDescriptionEntry` with `sourceType: "extension"`,
  separate `applicationStatus: "saved"`, and `ingestionStatus: "pending"`.
- Returns `created` for a new canonical URL and `duplicate` for a repeated
  canonical/source URL without creating a second job.
- Loads old workspace records by defaulting the new capture collection to an
  empty array.

This is the local Next.js API implementation for Sprint 1. The Sprint 2
extension is described below; a standalone agent bound explicitly to `127.0.0.1`
and extension pairing remain future work.

## Sprint 2 Implementation

The MV3 extension lives under `extension/`:

- `extension/manifest.json` uses `activeTab`, `scripting`, `storage`, and
  `tabs`, with loopback-only host permissions.
- `extension/service-worker.js` queries the active tab, captures visible body
  text through a privileged `scripting.executeScript` call, and sends the
  payload to `/api/local/ingest/page`.
- `extension/popup.html`, `popup.js`, and `popup.css` provide the JobOps AI
  popup, connection settings, import action, created/duplicate/error states,
  and an Open in JobOps action.
- `extension/shared.js` defines the capture contract and ingestion URL helper.
- `extension/README.md` documents local loading and token setup.

The extension stores the local bearer token in extension storage and never
injects it into the captured page. It does not call Ollama, access Gmail,
automate applications, or implement saved-job synchronization. The user must
load the unpacked extension and enter the same `JOBOPS_LOCAL_TOKEN` configured
for the local app.

## Sprint 4 Implementation

The Gmail MVP is isolated under `lib/gmail.ts` and `app/api/gmail/`:

- OAuth requests only `https://www.googleapis.com/auth/gmail.readonly`.
- `/api/gmail/connect` starts OAuth with a random state stored in an HTTP-only
  cookie; `/api/gmail/callback` validates the state before exchanging the code.
- `/api/gmail/status`, `/api/gmail/sync`, and `/api/gmail/disconnect` expose
  connection management without returning OAuth tokens.
- Sync resolves one configured Gmail label, defaults to `JobOps`, and reads at
  most 50 messages per run. It does not scan the mailbox or request modify,
  compose, send, or full-mailbox scopes.
- Only message/thread IDs, selected headers, bounded body text, links, and
  sync timestamps are retained as `GmailJobCandidate` records.
- Message IDs are persisted for idempotent repeat sync. Likely job candidates
  become regular `JobDescriptionEntry` records with `sourceType: "gmail"` and
  source metadata; unrelated labeled messages remain candidates without
  becoming jobs.
- OAuth tokens are stored outside the repository at `~/.jobops/gmail-token.json`
  by default, or at `JOBOPS_GMAIL_TOKEN_FILE` when configured. Tokens are not
  stored in workspace JSON, job records, extension storage, or logs.

The workspace now exposes Gmail label, connect, sync, and disconnect controls.
Google Cloud OAuth client credentials are configured through
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and the local callback URI.

## Sprint 5 Implementation

The provider boundary is implemented in `lib/llm.ts`:

- `LLMProvider` supports text, schema-validated structured output, provider and
  model identity, and health checks.
- `AnthropicProvider` preserves the existing Anthropic configuration.
- `OllamaProvider` uses `LLM_PROVIDER=ollama`, `OLLAMA_BASE_URL`, and
  `OLLAMA_MODEL`; it never hardcodes a model selection.
- Invalid JSON or schema-mismatched structured output becomes a recoverable
  error.

`lib/jobProcessing.ts` adds the first durable processing slice. It extracts
structured requirements, uses deterministic deadline evidence before asking a
provider, and creates advisory fit analysis when a base profile exists. The
results and provider/model metadata are persisted on the existing job record.

`POST /api/jobs/process` enqueues a `process_job` record. `lib/worker.ts`
processes that queue type, persists `processing`, `ready`, and `error` states,
and uses the existing retry policy for failures. The workspace job card exposes
a Process action. Resume tailoring is intentionally not part of this sprint;
imported jobs still converge on the existing tailoring endpoint in Sprint 6.

## Sprint 6 Implementation

`tailorResumeProfile` in `app/api/tailor/route.ts` is the shared canonical
tailoring function used by both the manual API request and automated worker
processing. Automated processing runs the existing grounded tailoring, QA,
revision, and LaTeX rendering sequence, then persists an immutable
`TailoredResumeVersion` with job ID, base profile identity, provider, model,
generation time, prompt version, LaTeX, and QA counts.

The job is not marked cleanly ready when QA still has issues. Prior versions
remain in `resumeVersions`; the current `tailoredLatex` field remains available
for the existing UI and download workflow. Analysis can still complete for
jobs without a base profile, but automated tailoring requires one.

## Sprint 7 Implementation

`lib/deadlines.ts` provides timezone-aware deadline categorization for the
workspace dashboard. Date-only deadlines are compared as calendar dates in the
user's local timezone; explicit timestamps are converted into that timezone
before comparison. The workspace Deadlines tab distinguishes:

- Overdue
- Today
- Within 3 days
- Within 7 days
- Later
- No deadline

Each deadline item shows its date, remaining or overdue days, confidence,
evidence, source, and source link. Unknown dates remain in No deadline and are
never inferred from unrelated timestamps.

## Sprint 8 Implementation

The first saved-job source is LinkedIn through `LinkedInSavedJobsAdapter` in
`lib/savedJobs.ts`. It accepts a capture of the user's authenticated saved-jobs
page, extracts LinkedIn job URLs and source IDs, and syncs them through
`POST /api/local/saved-jobs` using the existing local bearer token.

- Saved references are scoped to the `linkedin` adapter and deduplicated by
  source external ID or canonical URL.
- Reference-only jobs are imported as `sourceType: "saved_jobs"` with
  `ingestionStatus: "needs_review"`; they are not silently treated as complete
  job descriptions.
- Unsupported sources return an explicit automation-unavailable response with
  the fallback to open the job page and use the existing extension capture.
- No job-site passwords are stored, no primary browser profile is automated,
  and no CAPTCHA or access control is bypassed.

## Executive Summary

The existing application is a Next.js App Router application with a client-side
workspace UI and server routes that call file-backed libraries. The current
workspace source of truth is `data/local-workspace.json`, accessed through
`lib/localWorkspace.ts`. It stores sessions, memories, saved job descriptions,
the base resume profile, and an update timestamp.

The existing resume workflow is reusable and should remain canonical:

1. `app/api/profile/ingest/route.ts` parses a resume source into `ResumeProfile`.
2. `app/api/tailor/route.ts` extracts keywords, tailors the profile with
   Anthropic tool use, assesses fit, runs `lib/resumeQA.ts`, and applies limited
   revision passes.
3. `lib/renderLatex.ts` renders the resulting profile to LaTeX.
4. `app/workspace/page.tsx` stores the returned LaTeX and QA report on the saved
   job entry.

There is no current PDF compilation step, durable resume-version directory, or
separate application status. The current saved-job `status` mixes the saved,
tailoring, ready, and error states and must not be reused as the future
processing status without a compatibility migration.

## Current Data and Persistence

### Workspace data

- `types/workspace.ts` defines `LocalWorkspace`, `MemoryEntry`,
  `JobDescriptionEntry`, interview prep packets, and the current saved-job
  status union.
- `lib/localWorkspace.ts` reads and writes `data/local-workspace.json`.
  Writes normalize missing arrays and update `updatedAt`.
- `lib/dataDir.ts` resolves the data directory to `data/` locally and to a
  temporary directory when `VERCEL` is set. This makes the hosted deployment
  unsuitable as the source of truth for local automation.
- `app/api/workspace/route.ts` exposes unauthenticated GET and PUT operations
  around the local workspace file.
- `app/workspace/page.tsx` hydrates from `/api/workspace`, keeps a browser
  localStorage fallback, and sends workspace mutations back to the route.

### Other file-backed stores

- `lib/database.ts` stores the analysis corpus and base profile in
  `corpus.json` and `base-profile.json`, with optional SQLite/FTS5 support via
  `lib/sqlite.ts`.
- `lib/jobs.ts` stores generic job-run state and results in `jobs.json`.
- `lib/queue.ts` stores queued work in `queue.json`; it is separate from the
  workspace file and the corpus store.
- `data/jobs.json`, `data/local-workspace.json`, and `data/queue.json` are
  checked-in local data fixtures/state files. Future automation work must
  confirm whether these are fixtures or user data before changing their role.

### Persistence conclusion

The repository currently has multiple file-backed stores rather than one shared
job repository. The preferred automation direction is to extend the existing
workspace/data layer first, or introduce a clearly owned shared job repository
used by both Next.js and the local agent. Do not let the agent create a second
independent job database.

## Current Job Flow

### Manual job entry

The primary UI path is in `app/workspace/page.tsx`:

- The user pastes text or supplies a URL.
- `lib/jobMetadata.ts` infers title and company.
- `/api/job-link` can fetch and strip HTML from a URL.
- A `JobDescriptionEntry` is created in the browser and persisted through
  `/api/workspace`.
- The original JD text remains in `job.text`.

`/api/job-link` validates only the URL scheme, fetches the remote page, extracts
the HTML title, and converts generic HTML to text. It is not a generic page
capture API, does not preserve raw captures, and does not perform
deduplication.

### Existing API routes

- `/api/workspace`: read/write the local workspace.
- `/api/job-link`: fetch a job URL and return title/text/url.
- `/api/profile`: read or update profile-related data.
- `/api/profile/ingest`: LLM-assisted resume source parsing.
- `/api/tailor`: canonical resume tailoring, fit assessment, and deterministic
  QA.
- `/api/tailor/chat`: targeted edits to a current draft profile.
- `/api/interview-prep`: grounded interview packet generation.
- `/api/audit`: ATS keyword and format audit.
- `/api/analyze`: analyzes a JD through `lib/analyze.ts`.
- `/api/search` and `/api/search-jobs`: corpus/job search and live job search
  surfaces.
- `/api/corpus`: corpus operations.
- `/api/jobs/analyze`: enqueue an `analyze` queue job.
- `/api/jobs/status`: read generic job-run status/results.
- `/api/jobs/results`: read saved job results.
- `/api/jobs/backfill`: queue/backfill support for embeddings.
- `/api/worker/health`: worker health surface.
- `/api/chat`: general chat.
- `/api/parse-pdf`: PDF text extraction.
- `/api/prompt`: prompt-store access.

The Sprint 1 route now implements authenticated local ingestion, source capture
storage, normalized job creation, and canonical URL duplicate handling. The
older workspace route remains unauthenticated and is not used as the extension
credential boundary.

## Resume, LaTeX, QA, and AI Pipeline

### Profile and tailoring

- `types/profile.ts` defines `ResumeProfile`, `QAIssue`, `MatchAssessment`, and
  the current tailor response shape.
- `app/api/profile/ingest/route.ts` calls Anthropic structured tool use and
  normalizes IDs and arrays before saving the base profile through
  `lib/database.ts`.
- `app/api/tailor/route.ts` is the canonical tailoring implementation. It uses
  `lib/ollama.ts` for keyword extraction/fallback, Anthropic tools from
  `lib/tools.ts`, `lib/resumeEdit.ts` for grounded edits, `lib/renderLatex.ts`,
  and `lib/resumeQA.ts`.
- `app/api/tailor/chat/route.ts` applies targeted profile edits and re-runs QA
  for the draft.
- `app/workspace/page.tsx` calls the same `/api/tailor` endpoint for saved jobs;
  imported jobs must converge here rather than receive a new generator.

### LaTeX and QA

- `lib/renderLatex.ts` generates an ATS-oriented LaTeX document from a
  `ResumeProfile` and escapes LaTeX special characters.
- `lib/resumeQA.ts` checks punctuation, formulaic phrases, repeated verbs,
  bullet length, experience XYZ shape, bullet balance, and keyword coverage.
- `lib/audit-format.ts` checks contact information, sections, and date
  consistency for the ATS audit.
- `lib/audit.ts` combines LLM keyword results with deterministic format checks.
- The current system returns LaTeX and QA findings but does not compile LaTeX
  to PDF. Sprint 6 must add compilation and version metadata without replacing
  this pipeline.

### AI providers

- `lib/anthropicClient.ts` creates a direct Anthropic client from
  `ANTHROPIC_API_KEY` and uses `ANTHROPIC_MODEL`, defaulting to
  `claude-haiku-4-5` in individual routes.
- Anthropic calls are made directly in profile ingestion, tailoring, interview
  prep, ATS audit, chat, and analysis routes.
- `lib/ollama.ts` is currently a narrow keyword helper. It hardcodes
  `http://localhost:11434/api/generate` and defaults to `llama3.1:8b`; it has a
  fallback keyword extractor. It is not an `LLMProvider` abstraction and does
  not provide structured output validation or health checks.
- `lib/analyze.ts` adds optional embedding/RAG context through `lib/vector.ts`,
  `lib/embeddings.ts`, and corpus search. This is existing memory/RAG behavior
  to preserve, not a complete automation provider layer.

## Worker and Queue

- `lib/queue.ts` provides file-backed enqueue/schedule/fetch/complete/fail
  primitives with retry metadata.
- `lib/worker.ts` polls the queue and currently knows `backfill` and `analyze`
  job types. It processes one fetched batch serially and persists analyze
  results through `lib/jobs.ts`.
- `app/api/jobs/analyze/route.ts` is the existing queue-enqueue example.
- `Dockerfile`, `docker-compose.yml`, `DOCS/WORKER.md`, and the `worker`/
  `worker:dev` package scripts describe the compiled worker deployment.
- This is the nearest reusable foundation for a durable automation queue, but
  it does not yet model ingestion stages, per-job transitions, recovery of
  transient states, controlled LLM concurrency, or resume outputs.

### Proposed queue insertion point

Extend the queue contract around a durable automation job record rather than
putting the workflow in `app/workspace/page.tsx`. Add explicit stage and retry
state in the shared job repository, then let the worker call domain services
for normalization, deduplication, extraction, fit analysis, tailoring, and QA.
Keep `analyze` compatibility intact while migrating callers incrementally.

## Proposed Automation Components and Insertion Points

### Local agent

Add a separate local Node/TypeScript process, likely under a new `agent/` or
`local-agent/` directory, with a loopback HTTP server bound explicitly to
`127.0.0.1`. It should use shared domain/data modules from the application,
not import client components or duplicate workspace persistence.

Responsibilities:

- authenticated extension API;
- capture validation and persistence;
- queue scheduling and recovery;
- Gmail and saved-job adapters;
- provider selection and health checks;
- structured logs with secret redaction.

The port should come from `JOBOPS_LOCAL_PORT` with the handoff's example
default of `4317`. `JOBOPS_LOCAL_TOKEN` must be read from the environment or a
local credential mechanism, never hardcoded or logged.

### Ingestion API

The requested `POST /api/local/ingest/page` should be implemented in the local
agent first, because the local agent is the automation control plane. If the
Next.js app also exposes a route for local development, it must delegate to the
same ingestion service and persistence layer.

The service should validate URL, hostname, capture timestamp, title bounds,
and visible-text bounds. It should preserve the raw capture before parsing and
return the specified `created`, `duplicate`, `updated`, or `needs_review`
action. It must use an idempotency key derived from source identity/capture
metadata rather than trusting client-provided title/company values.

### Shared job model

Extend `JobDescriptionEntry` compatibly or introduce a versioned domain job
record consumed by the workspace adapter. Preserve `job.text` as the original
JD. Add optional source, canonical URL, external ID, timestamps, deadline
evidence, processing state, application state, source IDs/metadata, errors,
requirements, and duplicate references.

Do not overload the current `status` field. Maintain a migration adapter for
old records where `saved`, `tailoring`, `ready`, and `error` currently describe
the manual workflow.

### Generic browser extraction and extension

Create a generic extraction module with this order:

1. JSON-LD
2. semantic HTML
3. metadata
4. page title
5. visible text
6. later, LLM interpretation for ambiguity

Preserve the raw page capture so extraction can improve without revisiting the
source. The Chrome extension should be a separate Manifest V3 project. Its
content script should collect the minimum visible data; its service worker
should perform privileged communication to the authenticated local agent. It
must not call Ollama or contain the main AI pipeline.

Start with a `GenericAdapter` implementing the proposed
`BrowserSourceAdapter`. Add platform adapters only after the generic path is
validated.

### Gmail connector

Add Gmail as a read-only local-agent adapter, isolated from the rest of the
system so OAuth verification/compliance does not affect browser ingestion.
Use the minimum read-only scope and a configured label, defaulting to the
user's `JobOps` label. Persist only message/thread IDs and the fields needed to
extract candidates. Do not store refresh tokens in workspace JSON, job records,
extension storage, source control, or logs. Do not request send/modify scopes.

### LLM provider abstraction

Create a provider boundary in a shared server/agent module matching the
handoff's `LLMProvider` contract. Wrap the existing Anthropic calls behind the
boundary incrementally; do not make route-level provider selection spread
through the UI. Move the current Ollama keyword helper behind an
`OllamaProvider` configured by `OLLAMA_BASE_URL` and `OLLAMA_MODEL`.

All structured output must be schema-validated. Provider health failures and
malformed model output should become recoverable processing errors, not silent
partial records.

### Deadline and requirements services

Add deterministic URL/date/metadata parsing before invoking a model. Preserve
evidence and confidence. Only use an LLM for ambiguous interpretation. Keep
structured requirements and original JD text separate.

These services belong below the UI and above persistence so browser, Gmail, and
manual jobs share the same normalization and extraction behavior.

### Inbox and dashboard

The current workspace UI has saved-job cards and tabs but no imported-job inbox,
deadline dashboard, source transparency panel, or separate application state.
The nearest UI insertion point is the workspace section model in
`app/workspace/page.tsx`; it should eventually consume a server-side domain
view model rather than expand the page's already large local state machine.

## Security and Operational Findings

- `/api/workspace` currently has no authentication or authorization at the
  route boundary; its browser session is application state, not a local-agent
  authentication mechanism.
- `/api/job-link` fetches arbitrary HTTP(S) URLs from the server route. A local
  agent ingestion API must define SSRF protections and request limits rather
  than reusing this behavior blindly.
- The current source contains environment-based API key handling, but no
  local-agent token pairing or rotation mechanism.
- Current worker logs include job IDs and summaries. Future structured logging
  must avoid raw email bodies, tokens, cookies, API keys, and full captures.
- The hosted deployment uses temporary data when `VERCEL` is set. It cannot
  read the user's local filesystem and must remain a demo/remote-viewing
  environment for the MVP.

## Tests and Validation Already Present

- `tests/parsing.test.ts`: parsing and extraction helpers.
- `tests/resume-tailoring.test.ts`: keyword filtering, LaTeX rendering,
  grounded edits, and deterministic QA behavior.
- `tests/audit.test.ts`: ATS score, format checks, and keyword normalization.
- `tests/auth-redirect.test.ts`: auth redirect behavior.
- `tests/tools.test.ts`: structured tool behavior.
- `tests/evals/career-workspace.evals.test.ts`: deterministic workspace evals
  for QA, LaTeX, metadata inference, and interview-prep export.
- `lib/extractJSON.test.ts`: JSON extraction helper tests.
- `scripts/mcp-jobops.mjs --self-test`: read-only MCP workspace contract check.

Automation work should add unit tests at the domain boundary first, then route
and agent contract tests. The first ingestion tests should cover valid create,
repeat idempotency, invalid token rejection, malformed payload rejection, and
old workspace records loading unchanged.

## Validation Commands

The commands declared by `package.json` and repository docs are:

```text
npm run lint
npm test -- --run
npm run evals
npm run build
npm run mcp:self-test
```

The worker has `npm run worker` and `npm run worker:dev` entry points, but these
are long-running services rather than Sprint 0 validation commands. The audit
should report their runtime/configuration requirements rather than invent a
new test script.

## Sprint 0 Limitations

- No automation code was added.
- No local agent, extension, Gmail OAuth flow, provider abstraction, deadline
  system, inbox, or new job schema was implemented.
- No PDF compiler was found in the current resume pipeline.
- Existing persistence is split across workspace, corpus/profile, queue, and
  generic job-result files.
- The Sprint 1 ingestion route provides bearer-token authentication, but the
  general `/api/workspace` route remains unauthenticated.
- The current `lib/ollama.ts` configuration does not yet match the required
  provider configuration contract.

## Sprint 1-8 Validation

- `lib/localIngestion.test.ts`: normalization, creation, raw capture
  preservation, duplicate handling, validation, and legacy records.
- `app/api/local/ingest/page/route.test.ts`: missing, invalid, and unconfigured
  token rejection.
- Sprint 3 coverage also verifies external-ID precedence, tracking-parameter URL
  normalization, company/title matching, and similarity-based review records.
- Sprint 7 coverage verifies local calendar-day boundaries, timezone conversion,
  urgency buckets, and explicit unknown deadlines.
- Sprint 8 coverage verifies LinkedIn saved-job extraction, review-state imports,
  source-ID deduplication, and unsupported-source fallback behavior.
- Full suite result after Sprint 8: 65 tests passed.

## Recommended Next Sprint

Sprint 1 should implement only the local ingestion API and its shared domain
service: authenticated loopback endpoint, bounded raw page capture, compatible
job persistence, normalized title/company/source fields, and idempotent create
or duplicate behavior. Add focused tests before connecting the Chrome
extension. Do not implement Gmail, automatic processing, or resume generation
in that sprint.