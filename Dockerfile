# ── Stage 1: Install dependencies ───────────────────────────────────────────
FROM node:20-bullseye-slim AS deps

# Install build tools needed for better-sqlite3 native module
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential python3 pkg-config libsqlite3-dev ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./

ENV NPM_CONFIG_LEGACY_PEER_DEPS=true
RUN npm install --legacy-peer-deps --no-audit --no-fund

# ── Stage 2: Build Next.js app ───────────────────────────────────────────────
FROM node:20-bullseye-slim AS builder

# Need build tools here too for any native rebuilds during next build
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential python3 pkg-config libsqlite3-dev ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Disable telemetry and provide dummy API keys so `next build` doesn't fail
# (real secrets are injected at runtime via Railway env vars)
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV ANTHROPIC_API_KEY=sk-ant-placeholder
ENV OPENAI_API_KEY=sk-placeholder

RUN npm run build

# ── Stage 3: Production runner ───────────────────────────────────────────────
FROM node:20-bullseye-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Runtime deps for better-sqlite3 native module
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsqlite3-0 ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Copy Next.js standalone build
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy better-sqlite3 native binaries that standalone won't bundle on its own
COPY --from=builder /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=builder /app/node_modules/bindings ./node_modules/bindings
COPY --from=builder /app/node_modules/file-uri-to-path ./node_modules/file-uri-to-path

# Persistent data directory (mounted as Railway volume)
RUN mkdir -p /app/data
VOLUME ["/app/data"]

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]

# ── Stage 4: Background worker (separate Railway service) ────────────────────
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

VOLUME ["/app/data"]
CMD ["node", ".worker-dist/lib/worker.js", "loop"]
