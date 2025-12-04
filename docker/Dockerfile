# syntax=docker/dockerfile:1.4

# =============================================================================
# Base stage for Node.js
# =============================================================================
FROM node:20-slim AS base
WORKDIR /app
ENV NODE_ENV=production

# =============================================================================
# Shared Builder Stage - Builds packages/shared once
# =============================================================================
FROM base AS shared-builder
WORKDIR /app

# Copy root config and lockfile
COPY tsconfig.base.json package.json package-lock.json /app/
COPY types /app/types

# Copy confusable package (complete)
COPY packages/confusable /app/packages/confusable

# Copy shared package source
COPY packages/shared/package.json packages/shared/tsconfig.json /app/packages/shared/
COPY packages/shared/src /app/packages/shared/src

# Install confusable dependencies first (so confusables.js is available)
# Then install shared dependencies (which links to confusable via file:../confusable)
# Finally build shared and pack both
# Network retry logic: npm will retry on network failures
RUN --mount=type=cache,target=/root/.npm \
    set -e && \
    npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    cd /app/packages/confusable && \
    (npm install --no-audit --progress=false || \
     (echo "Retrying confusable install..." && sleep 5 && npm install --no-audit --progress=false)) && \
    cd /app && \
    (npm install -w packages/shared --include=dev --no-audit --progress=false || \
     (echo "Retrying shared install..." && sleep 5 && npm install -w packages/shared --include=dev --no-audit --progress=false)) && \
    cd /app/packages/shared && npm run build && npm pack && \
    cd /app/packages/confusable && npm pack

# =============================================================================
# Service: Control Plane (Builder)
# =============================================================================
FROM base AS control-plane-builder
WORKDIR /app

# Install build tools for better-sqlite3 native compilation
RUN apt-get update && apt-get install -y python3 make g++ wget && rm -rf /var/lib/apt/lists/*

# Copy shared package tarball from builder
COPY --from=shared-builder /app/packages/shared/wbscanner-shared-0.1.0.tgz /app/packages/shared/
COPY --from=shared-builder /app/packages/confusable/confusable-0.1.0.tgz /app/packages/confusable/

# Install ALL dependencies (including dev) to build
COPY services/control-plane/package.json services/control-plane/tsconfig.json /app/services/control-plane/
RUN --mount=type=cache,target=/root/.npm \
    cd /app/services/control-plane && \
    npm install /app/packages/shared/wbscanner-shared-0.1.0.tgz --include=dev --no-audit --progress=false --legacy-peer-deps && \
    npm install /app/packages/confusable/confusable-0.1.0.tgz --include=dev --no-audit --progress=false --legacy-peer-deps && \
    npm install --include=dev --no-audit --progress=false --legacy-peer-deps

# Copy source and build
COPY tsconfig.base.json /app/
COPY types /app/types
COPY services/control-plane/src /app/services/control-plane/src
RUN cd /app/services/control-plane && npm run build

# =============================================================================
# Service: Control Plane (Production)
# =============================================================================
FROM base AS control-plane-prod-deps
WORKDIR /app

# Install build tools for better-sqlite3 native compilation
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy shared package tarball from builder
COPY --from=shared-builder /app/packages/shared/wbscanner-shared-0.1.0.tgz /app/packages/shared/
COPY --from=shared-builder /app/packages/confusable/confusable-0.1.0.tgz /app/packages/confusable/

# Install PRODUCTION dependencies only
COPY services/control-plane/package.json /app/services/control-plane/
RUN --mount=type=cache,target=/root/.npm \
    cd /app/services/control-plane && \
    npm install /app/packages/shared/wbscanner-shared-0.1.0.tgz --omit=dev --no-audit --progress=false --legacy-peer-deps && \
    npm install /app/packages/confusable/confusable-0.1.0.tgz --omit=dev --no-audit --progress=false --legacy-peer-deps && \
    npm install --omit=dev --no-audit --progress=false --legacy-peer-deps

# =============================================================================
# Service: Control Plane (Final)
# =============================================================================
FROM base AS control-plane
WORKDIR /app

# Copy production node_modules from prod-deps stage
COPY --from=control-plane-prod-deps /app/services/control-plane/node_modules /app/services/control-plane/node_modules

# Copy built artifacts from builder stage
COPY --from=control-plane-builder /app/services/control-plane/dist /app/services/control-plane/dist
COPY --from=control-plane-builder /app/services/control-plane/package.json /app/services/control-plane/

# Setup storage and user
RUN mkdir -p /app/storage && chown -R node:node /app/storage
USER node
WORKDIR /app/services/control-plane

EXPOSE 8080
CMD ["node", "dist/index.js"]

# =============================================================================
# Service: Scan Orchestrator (Builder)
# =============================================================================
FROM base AS scan-orchestrator-builder
WORKDIR /app

# Install build tools for better-sqlite3 native compilation
RUN apt-get update && apt-get install -y python3 make g++ wget && rm -rf /var/lib/apt/lists/*

# Copy shared package tarball from builder
COPY --from=shared-builder /app/packages/shared/wbscanner-shared-0.1.0.tgz /app/packages/shared/
COPY --from=shared-builder /app/packages/confusable/confusable-0.1.0.tgz /app/packages/confusable/

# Install ALL dependencies (including dev) to build
COPY services/scan-orchestrator/package.json services/scan-orchestrator/tsconfig.json /app/services/scan-orchestrator/
RUN --mount=type=cache,target=/root/.npm \
    cd /app/services/scan-orchestrator && \
    npm install /app/packages/shared/wbscanner-shared-0.1.0.tgz --include=dev --no-audit --progress=false --legacy-peer-deps && \
    npm install /app/packages/confusable/confusable-0.1.0.tgz --include=dev --no-audit --progress=false --legacy-peer-deps && \
    npm install --include=dev --no-audit --progress=false --legacy-peer-deps

# Copy source and build
COPY tsconfig.base.json /app/
COPY types /app/types
COPY services/scan-orchestrator/src /app/services/scan-orchestrator/src
RUN cd /app/services/scan-orchestrator && npm run build

# =============================================================================
# Service: Scan Orchestrator (Production Dependencies)
# =============================================================================
FROM base AS scan-orchestrator-prod-deps
WORKDIR /app

# Install build tools for better-sqlite3 native compilation
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy shared package tarball from builder
COPY --from=shared-builder /app/packages/shared/wbscanner-shared-0.1.0.tgz /app/packages/shared/
COPY --from=shared-builder /app/packages/confusable/confusable-0.1.0.tgz /app/packages/confusable/

# Install PRODUCTION dependencies only
COPY services/scan-orchestrator/package.json /app/services/scan-orchestrator/
RUN --mount=type=cache,target=/root/.npm \
    cd /app/services/scan-orchestrator && \
    npm install /app/packages/shared/wbscanner-shared-0.1.0.tgz --omit=dev --no-audit --progress=false --legacy-peer-deps && \
    npm install /app/packages/confusable/confusable-0.1.0.tgz --omit=dev --no-audit --progress=false --legacy-peer-deps && \
    npm install --omit=dev --no-audit --progress=false --legacy-peer-deps

# =============================================================================
# Service: Scan Orchestrator (Final)
# =============================================================================
FROM base AS scan-orchestrator
WORKDIR /app

# Copy production node_modules from prod-deps stage
COPY --from=scan-orchestrator-prod-deps /app/services/scan-orchestrator/node_modules /app/services/scan-orchestrator/node_modules

# Copy built artifacts from builder stage
COPY --from=scan-orchestrator-builder /app/services/scan-orchestrator/dist /app/services/scan-orchestrator/dist
COPY --from=scan-orchestrator-builder /app/services/scan-orchestrator/package.json /app/services/scan-orchestrator/

# Setup storage and user
RUN mkdir -p /app/storage && chown -R node:node /app/storage
USER node
WORKDIR /app/services/scan-orchestrator

EXPOSE 3001
CMD ["node", "dist/index.js"]

# =============================================================================
# Service: WA Client (Builder)
# =============================================================================
FROM base AS wa-client-builder
WORKDIR /app

# Copy shared package tarball from builder
COPY --from=shared-builder /app/packages/shared/wbscanner-shared-0.1.0.tgz /app/packages/shared/
COPY --from=shared-builder /app/packages/confusable/confusable-0.1.0.tgz /app/packages/confusable/

# Install ALL dependencies (including dev) to build
COPY services/wa-client/package.json services/wa-client/tsconfig.json /app/services/wa-client/
RUN --mount=type=cache,target=/root/.npm \
    cd /app/services/wa-client && \
    npm install /app/packages/shared/wbscanner-shared-0.1.0.tgz --include=dev --no-audit --progress=false --legacy-peer-deps && \
    npm install /app/packages/confusable/confusable-0.1.0.tgz --include=dev --no-audit --progress=false --legacy-peer-deps && \
    npm install --include=dev --no-audit --progress=false --legacy-peer-deps

# Copy source and build
COPY tsconfig.base.json /app/
COPY types /app/types
COPY services/wa-client/src /app/services/wa-client/src
RUN cd /app/services/wa-client && npm run build

# =============================================================================
# Service: WA Client (Production Dependencies)
# =============================================================================
FROM base AS wa-client-prod-deps
WORKDIR /app

# Copy shared package tarball from builder
COPY --from=shared-builder /app/packages/shared/wbscanner-shared-0.1.0.tgz /app/packages/shared/
COPY --from=shared-builder /app/packages/confusable/confusable-0.1.0.tgz /app/packages/confusable/

# Install PRODUCTION dependencies only
COPY services/wa-client/package.json /app/services/wa-client/
RUN --mount=type=cache,target=/root/.npm \
    cd /app/services/wa-client && \
    npm install /app/packages/shared/wbscanner-shared-0.1.0.tgz --omit=dev --no-audit --progress=false --legacy-peer-deps && \
    npm install /app/packages/confusable/confusable-0.1.0.tgz --omit=dev --no-audit --progress=false --legacy-peer-deps && \
    npm install --omit=dev --no-audit --progress=false --legacy-peer-deps

# =============================================================================
# Service: WA Client (Final Runtime)
# =============================================================================
FROM ghcr.io/puppeteer/puppeteer:22.13.1 AS wa-client
USER root
WORKDIR /app
ENV NODE_ENV=production \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Copy production node_modules from prod-deps stage
COPY --from=wa-client-prod-deps /app/services/wa-client/node_modules /app/services/wa-client/node_modules

# Copy built artifacts from builder stage
COPY --from=wa-client-builder /app/services/wa-client/dist /app/services/wa-client/dist
COPY --from=wa-client-builder /app/services/wa-client/package.json /app/services/wa-client/

# Setup storage and user
RUN mkdir -p /app/services/wa-client/data /app/storage && chown -R pptruser:pptruser /app/services/wa-client /app/storage
USER pptruser
VOLUME ["/app/services/wa-client/data"]
EXPOSE 3000
WORKDIR /app/services/wa-client
CMD ["node", "dist/index.js"]

# =============================================================================
# Service: Migrate
# =============================================================================
FROM base AS migrate
WORKDIR /app

# Install build tools for better-sqlite3 native compilation
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy shared package tarball from builder
COPY --from=shared-builder /app/packages/shared/wbscanner-shared-0.1.0.tgz /app/packages/shared/

# Install dependencies
COPY package.json /app/
COPY packages/shared/package.json /app/packages/shared/

# Install dependencies including shared (production only)
RUN --mount=type=cache,target=/root/.npm \
    npm install /app/packages/shared/wbscanner-shared-0.1.0.tgz --omit=dev --no-audit --progress=false

# Copy migration script and migrations
COPY scripts/run-migrations.js /app/scripts/
COPY db/migrations /app/db/migrations

# Setup storage
RUN mkdir -p /app/storage && chmod 777 /app/storage

CMD ["node", "scripts/run-migrations.js"]
