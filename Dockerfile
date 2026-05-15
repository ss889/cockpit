FROM node:20-bullseye-slim AS base

# Install build deps for native modules (better-sqlite3)
FROM base AS deps
RUN apt-get update && apt-get install -y --no-install-recommends \
	build-essential python3 pkg-config libsqlite3-dev ca-certificates && \
	rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
# Install full dependencies (including dev) so the builder can run the build step
ENV NPM_CONFIG_LEGACY_PEER_DEPS=true
# Use legacy peer deps resolution to avoid CI/npm failures
# Install with `npm install --legacy-peer-deps` to avoid lockfile mismatch issues in CI
RUN npm install --legacy-peer-deps --no-audit --no-fund

FROM base AS builder
RUN apt-get update && apt-get install -y --no-install-recommends build-essential python3 pkg-config libsqlite3-dev ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
# Ensure runtime deps for sqlite
RUN apt-get update && apt-get install -y --no-install-recommends libsqlite3-0 ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
VOLUME ["/app/data"]
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]

FROM base AS worker
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends libsqlite3-0 ca-certificates curl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx tsc -p tsconfig.worker.json
VOLUME ["/app/data"]
CMD ["node", ".worker-dist/lib/worker.js", "loop"]
