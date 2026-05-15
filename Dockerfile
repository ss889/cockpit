# ── Stage 1: Install dependencies ───────────────────────────────────────────
FROM node:20-bullseye-slim AS deps

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential python3 pkg-config libsqlite3-dev ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./

ENV NPM_CONFIG_LEGACY_PEER_DEPS=true
RUN npm install --legacy-peer-deps --no-audit --no-fund

# ── Stage 2: Build Next.js app ───────────────────────────────────────────────
FROM node:20-bullseye-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential python3 pkg-config libsqlite3-dev ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV ANTHROPIC_API_KEY=sk-ant-placeholder
ENV OPENAI_API_KEY=sk-placeholder

RUN npm run build

# ── Stage 3: Background worker (separate Railway service if needed) ───────────
FROM node:20-bullseye-slim AS worker

WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends \
    libsqlite3-0 ca-certificates curl && \
    rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx tsc -p tsconfig.worker.json

CMD ["node", ".worker-dist/lib/worker.js", "loop"]

# ── Stage 4: Production runner — LAST = default Docker build target ───────────
FROM node:20-bullseye-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    libsqlite3-0 ca-certificates && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy better-sqlite3 native binaries (not bundled by Next.js standalone)
COPY --from=builder /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=builder /app/node_modules/bindings ./node_modules/bindings
COPY --from=builder /app/node_modules/file-uri-to-path ./node_modules/file-uri-to-path

RUN mkdir -p /app/data

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
