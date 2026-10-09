# Resume Tailoring V2: Sprint 0 Audit

Date: 2026-10-06

Scope: repository audit only. This sprint does not change application behavior,
prompts, schemas, persistence, or runtime flow.

## Executive Summary

JobOps currently has a working, conservative tailoring pipeline:

1. A saved job description and `ResumeProfile` are sent to `POST /api/tailor`.
2. The route extracts filtered keywords, calls Claude tool use to rewrite the
   profile, and asks Claude for a match assessment.
3. Deterministic QA runs on the generated profile.
4. Up to two deterministic revision passes ask Claude to repair flagged bullets.
5. The final profile is rendered to LaTeX and returned to the workspace.

The current pipeline does not yet have separate structured stages for JD
strategy, resume evidence inventory, requirement-to-evidence mapping, resume
strategy planning, factual verification, PDF compilation, or immutable export
version metadata. The existing architecture document describes some future
versioning concepts, but the current source of truth is the implementation
listed below.

## 1. Current Tailoring Flow

### Entry points

- Manual and saved-job UI: `app/workspace/page.tsx`
  - `generateTailoredResume`
  - `tailorSavedJob`
  - `handleChatTailorRequest`
- Tailoring API: `app/api/tailor/route.ts`
  - `POST` validates the JD and profile, then calls `tailorResumeProfile`.
- Resume ingestion API: `app/api/profile/ingest/route.ts`
  - Parses LaTeX, PDF-extracted text, or pasted text into `ResumeProfile` using
    the `extract_resume_profile` tool.
- Interactive refinement API: `app/api/tailor/chat/route.ts`
  - Applies targeted edits through `edit_resume_section`, then runs QA on the
    edited profile.
- Match reassessment API: `app/api/tailor/assess/route.ts`
  - Reuses `assessMatch` for the current refined profile.

### Current runtime sequence

`tailorResumeProfile` in `app/api/tailor/route.ts` currently:

1. Calls `extractKeywords` and `filterKeywords` from `lib/ollama.ts`.
2. Calls `tailorProfile` and `assessMatch` in parallel.
3. Runs `runQA` from `lib/resumeQA.ts`.
4. Runs up to two `reviseFlaggedBullets` passes for location-specific issues.
5. Returns `{ profile, latex, keywords, match, qa }`.

This is a single generation-oriented pipeline. The requested V2 strategy layer
does not exist yet.

## 2. Job Bank and JD Storage

There are two related storage paths:

- Operational saved jobs:
  - `types/workspace.ts`: `JobDescriptionEntry`.
  - `lib/localWorkspace.ts`: reads and writes `data/local-workspace.json`.
  - `app/api/workspace/route.ts`: workspace GET/PUT API.
  - `app/workspace/page.tsx`: saves manual, extension, Gmail, and saved-job
    records into `LocalWorkspace.jobDescriptions`.
- Analysis corpus / RAG corpus:
  - `lib/database.ts`: file-backed `corpus.json` with optional SQLite/FTS5.
  - `saveJobDescription`, `searchSimilar`, and `listCorpus`.
  - `lib/sqlite.ts`: optional SQLite search and persistence adapter.
  - `lib/analyze.ts`: saves analyzed JDs and retrieves corpus matches.

`data/jobs.json` is an existing generic job-run store, not the primary Job Bank
for tailoring. `data/local-workspace.json` is the operational source of truth.

## 3. Base Resume Representation and Storage

- Type: `types/profile.ts` -> `ResumeProfile`.
- Ingestion: `app/api/profile/ingest/route.ts` -> `extract_resume_profile`.
- Normalization: `normalizeProfile` fills header fields, arrays, stable project
  IDs, and stable experience IDs.
- File-backed profile store: `lib/database.ts` -> `base-profile.json`, through
  `saveBaseProfile` and `getBaseProfile`.
- Workspace copy: `LocalWorkspace.baseResumeProfile` in
  `data/local-workspace.json`.
- Browser fallback: `jobops_base_resume_profile` localStorage key in
  `app/workspace/page.tsx`.

There is no explicit base-resume version identity. The current timestamp in
`base-profile.json` is not a stable version ID and is not attached to tailored
outputs.

## 4. Existing Prompts and Claude Calls

### Tailoring calls

`app/api/tailor/route.ts` contains:

- `buildTailorPrompt`: instructs Claude to rewrite bullets, select relevant
  projects, reorder existing skills, avoid fabrication, follow ATS-friendly
  LaTeX constraints, and keep bullets concise.
- `tailorProfile`: Claude tool call using `tailorResumeTool`.
- `assessMatch`: separate Claude JSON response for score, strong signals,
  required gaps, optional gaps, and recommendation.
- `reviseFlaggedBullets`: Claude tool call using
  `reviseResumeBulletsTool` for deterministic QA findings.

`app/api/tailor/chat/route.ts` contains `buildRefinePrompt`, which constrains
interactive edits to specific bullets and forbids unsupported claims.

`app/api/profile/ingest/route.ts` uses a structured extraction prompt for the
`extract_resume_profile` tool.

`app/api/audit/route.ts` has separate Claude calls for JD keyword extraction and
keyword presence assessment. These are ATS audit calls, not the tailoring
strategy pipeline.

The configured provider is Anthropic through `lib/anthropicClient.ts` and the
model comes from `ANTHROPIC_MODEL`, defaulting to `claude-haiku-4-5`.

## 5. RAG and Retrieval

RAG is currently used by the general analysis path, not the tailoring path:

- `lib/analyze.ts` dynamically loads `lib/vector.ts` and `lib/embeddings.ts`
  when embeddings are available.
- It falls back to `lib/database.ts` -> `searchSimilar` when embeddings are
  unavailable.
- Retrieved corpus excerpts are appended to the general analysis system prompt.

`app/api/tailor/route.ts` does not currently retrieve resume evidence from the
corpus or build a requirement-to-evidence map. V2 should not assume that the
existing JD corpus is a resume evidence inventory.

## 6. Structured Outputs and Schemas

Existing structured tool definitions are in `lib/tools.ts`:

- `extractProfileTool` / `extract_resume_profile`
- `tailorResumeTool` / `tailor_resume`
- `reviseResumeBulletsTool` / `revise_resume_bullets`
- General analysis and audit tools

Existing domain types are in `types/profile.ts`, `types/workspace.ts`, and
`types/audit.ts`. There are no current types for `JobStrategy`,
`ResumeEvidence`, `RequirementEvidenceMap`, `ResumeStrategy`,
`GeneratedBullet`, or `ResumeVerification`.

The first V2 additions should live in dedicated types and domain modules rather
than expanding the current tailoring tool output into one large schema.

## 7. LaTeX Generation and Export

- `lib/renderLatex.ts` -> `renderResumeLatex` generates a complete article
  document from `ResumeProfile`.
- `escapeLatex` and `escapeUrl` protect generated text and links.
- `app/workspace/page.tsx` keeps the current LaTeX in state and stores
  `tailoredLatex` on the selected `JobDescriptionEntry`.
- Download actions create a browser download through the client UI.

There is no server-side `.tex` output directory, PDF compilation command, PDF
artifact, compile status, or durable export metadata. The current implementation
does not verify that generated LaTeX compiles before calling it ready.

## 8. ATS Analysis and Existing QA

### Deterministic QA

`lib/resumeQA.ts` -> `runQA` checks:

- dash punctuation
- formulaic or AI-sounding phrases
- repeated opening verbs
- long bullets
- weak experience XYZ shape
- bullet-count imbalance
- low keyword coverage

`app/api/tailor/route.ts` uses QA before and after up to two revision passes.
`app/api/tailor/chat/route.ts` runs QA only for locations touched by an
interactive edit.

### ATS audit

- `app/api/audit/route.ts` orchestrates the ATS audit.
- `lib/audit.ts` defines keyword extraction/assessment tools, keyword
  normalization, score calculation, gaps, and suggestions.
- `lib/audit-format.ts` checks standard sections, date consistency, and contact
  information.

The ATS audit is separate from the tailor response's match assessment. V2 should
define whether these remain separate signals or are combined into a documented
readiness decision.

## 9. Tests and Evals

Relevant existing tests:

- `tests/resume-tailoring.test.ts`: QA, keyword filtering, LaTeX rendering,
  refinement edit targeting, and skill validation.
- `tests/audit.test.ts`: ATS audit behavior.
- `tests/evals/career-workspace.evals.test.ts`: deterministic QA, ATS-friendly
  LaTeX structure, JD metadata, and interview-prep export.
- `lib/extractJSON.test.ts`, `tests/parsing.test.ts`, and `tests/tools.test.ts`:
  parsing and tool schema coverage.
- API and ingestion tests under `app/api/` and `lib/` cover job persistence and
  automation boundaries.

The current evals do not compare strategic project selection, evidence coverage,
factual verification, or tailoring quality against a benchmark. There is no
Claude reference evaluator and no PDF compile test.

## 10. Output and Version Storage

Current output fields are part of `JobDescriptionEntry`:

- `tailoredLatex`
- `tailoredAt`
- `status`
- `error`
- optional `resumeVersions?: TailoredResumeVersion[]`

`TailoredResumeVersion` is declared in `types/workspace.ts`, but the current
tailoring UI path does not create or append immutable versions. The architecture
doc's proposed version metadata is therefore not yet an implemented contract.

Current downloaded files are browser-generated and are not tracked by the app.
There is no durable `resumes/<job-id>/` directory or metadata file.

## 11. Proposed V2 Insertion Points

Smallest implementation path, preserving existing behavior until each stage is
validated:

### Sprint 1: JD Strategy Analyzer

- Add `types/tailoring.ts` with `JobStrategy` and supporting types.
- Add `lib/tailoring/jobStrategy.ts` for schema validation and normalization.
- Add `app/api/tailor/strategy/route.ts` for one structured strategy call.
- Add focused tests for schema normalization and missing/ambiguous JD fields.
- Keep `app/api/tailor/route.ts` unchanged until strategy output is evaluated.

### Sprint 2: Resume Evidence Inventory

- Add `ResumeEvidence` types and a deterministic inventory builder from
  `ResumeProfile`.
- Add tests proving every claim and metric points to source resume text.
- Store intermediate evidence only after the persistence contract is defined.

### Sprint 3: Requirement-to-Evidence Mapping

- Add a structured mapping module using the strategy and evidence objects.
- Reuse existing retrieval only where it improves evidence lookup; do not treat
  generic corpus RAG as verified resume evidence.

### Sprint 4: Resume Strategy Planner

- Add `ResumeStrategy` output with project selection, de-emphasis, skills order,
  risks, and evidence gaps.
- Enforce content budget and preserve the existing LaTeX renderer.

### Sprint 5: Generation

- Replace the current all-at-once tailoring input with strategy and evidence
  inputs while retaining `tailorResumeTool` or a versioned successor.
- Preserve `validateSkills`, `sanitizeBullet`, and current QA integration.

### Sprint 6: Verification

- Add a separate grounded verification result and block readiness on high-risk
  unsupported claims.
- Re-run deterministic QA and ATS checks after verification.

### Sprint 7: Evaluation

- Add fixed benchmark fixtures and deterministic comparison scaffolding.
- Add optional Claude reference fixtures for evaluation only, never runtime.

### Sprint 8: UI and export

- Expose structured progress and optional strategy preview.
- Add compile/export status and immutable resume version persistence only after
  the storage contract is tested.

## 12. Exact Files to Create or Modify Later

Likely new files:

- `types/tailoring.ts`
- `lib/tailoring/jobStrategy.ts`
- `lib/tailoring/evidence.ts`
- `lib/tailoring/mapping.ts`
- `lib/tailoring/strategy.ts`
- `lib/tailoring/verification.ts`
- `app/api/tailor/strategy/route.ts`
- `app/api/tailor/plan/route.ts`
- benchmark fixtures and focused tests under `tests/tailoring/`
- a versioned resume persistence module under `lib/` after its contract is set

Likely later modifications:

- `app/api/tailor/route.ts`
- `app/api/profile/ingest/route.ts`
- `app/workspace/page.tsx`
- `types/profile.ts` and `types/workspace.ts`
- `lib/renderLatex.ts` only if compile/export metadata requires a narrow change
- `DOCS/EVALS_AND_MCP.md` and README workflow documentation

## 13. Risks and Regression Concerns

- A strategy stage can increase API cost and latency; benchmark evidence must
  justify each additional call.
- Project removal can damage completeness or page balance; selection must be
  reversible and versioned.
- Keyword optimization can introduce unsupported claims; verification must be a
  hard gate, not a display-only warning.
- The current `status` field mixes application/tailoring concepts. V2 should
  introduce separate processing/readiness states rather than reusing it.
- `tailoredLatex` is currently a mutable convenience field. Versioning must not
  silently overwrite earlier outputs.
- `assessMatch` currently compares keywords against the base profile summary,
  not the full generated resume; score semantics must be documented before V2.
- The current QA keyword check is substring-based and can over- or under-count
  multiword concepts.
- PDF compilation is absent, so LaTeX validity is currently inferred from string
  tests rather than a real compiler.
- Existing jobs and browser/localStorage fallback behavior must remain valid.
- Anthropic structured output failures must preserve the imported job and expose
  retryable errors.

## 14. Validation Commands Discovered

From `package.json` and repository documentation:

```text
npm run lint
npm test -- --run
npm run build
npm run evals
npm run mcp:self-test
```

These commands are validation only for Sprint 0. No runtime feature changes are
included in this audit.

## Sprint 0 Report

### Changed files

- `DOCS/TAILORING_V2_AUDIT.md`

### Tests run

- `npm run lint`: attempted, but PowerShell stopped at a pre-existing
  interactive confirmation prompt before the command executed.
- `npm test -- --run`: attempted in the same blocked shell state; no command
  output was produced.
- `npm run build`: attempted in the same blocked shell state; no command output
  was produced.
- `npm run evals`: attempted in the same blocked shell state; no command output
  was produced.
- `npm run mcp:self-test`: attempted in the same blocked shell state; no command
  output was produced.

The last known repository-wide validation before this audit was 17 test files
passed and 75 tests passed. That result predates this audit document and does
not replace the blocked fresh validation pass.

### Current test, build, lint, and eval status

- Tests: last known green result above; fresh run blocked before execution.
- Build: not freshly verified in this Sprint 0 pass.
- Lint: not freshly verified in this Sprint 0 pass.
- Evals: not freshly verified in this Sprint 0 pass.
- MCP self-test: not freshly verified in this Sprint 0 pass.

### Proposed Sprint 1 changes

Implement only the structured JD Strategy Analyzer, its normalization rules,
focused tests, and its API contract. Do not connect it to final resume
generation until the strategy output is validated.

### Known limitations

The current app can generate, refine, QA-check, audit, render, and download
LaTeX, but it cannot yet prove PDF compilation, maintain immutable tailored
versions, verify every generated claim against source evidence, or measure
strategic tailoring quality against a golden benchmark.