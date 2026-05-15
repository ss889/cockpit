# Worker — production startup

This document explains how the compiled worker runs in production and required environment variables.

Files
- Compiled worker output: `.worker-dist/lib/worker.js`

Run
- The worker runs as `node .worker-dist/lib/worker.js loop` inside the container.

Environment
- `ANTHROPIC_API_KEY` — Anthropic API key for `lib/analyze` (required for analyze jobs).
- `OPENAI_API_KEY` — Optional OpenAI key used for embeddings if configured.

Docker / Compose
- Provide secrets via a `.env` file in the repo root (copy `.env.example` and fill values). The `docker-compose.yml` will load these into services.
- The worker image includes `curl` so the compose healthcheck that calls the web service will succeed.

Notes
- Do not commit `.env` to source control. Add `.env` to `.gitignore`.
- For local development you can set the keys in your shell instead of `.env`.
