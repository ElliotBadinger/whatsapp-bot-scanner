# syntax=docker/dockerfile:1.4

# Base stage for Node.js
FROM node:20-slim AS base
WORKDIR /app
ENV NODE_ENV=production

# Shared Builder Stage - Builds packages/shared once
FROM base AS shared-builder
WORKDIR /app

# Copy root config and lockfile
COPY tsconfig.base.json package.json package-lock.json /app/
COPY types /app/types

# Copy shared package source
COPY packages/confusable /app/packages/confusable
COPY packages/shared/package.json packages/shared/tsconfig.json /app/packages/shared/
COPY packages/shared/src /app/packages/shared/src

# Install and build shared package
# We use npm ci to leverage the lockfile for faster, deterministic installs.
# We need to ignore scripts to prevent native builds.
# Since we are in a workspace, we install from root but scope to shared?
# Or just install everything? Installing everything might be heavy if we have many services.
# But we only copied shared.
# If we run npm install in root, it might fail if other workspaces are missing.
# So we'll run npm install in packages/shared but we need the lockfile.
# Actually, npm install in a workspace package folder doesn't use the root lockfile by default unless we use -w?
# Install and build shared package
# We use npm ci to leverage the lockfile for faster, deterministic installs.
# We need to ignore scripts to prevent native builds.
# Since we are in a workspace, we install from root but scope to shared?
# Or just install everything? Installing everything might be heavy if we have many services.
# But we only copied shared.
# If we run npm install in root, it might fail if other workspaces are missing.
# So we'll run npm install in packages/shared but we need the lockfile.
# Actually, npm install in a workspace package folder doesn't use the root lockfile by default unless we use -w?
# Install and build shared package
# We use npm install with lockfile (via root package-lock.json).
# We need dev dependencies to build (tsc), so we override NODE_ENV or use --include=dev.
# We also restore the cache mount for performance.
RUN --mount=type=cache,target=/root/.npm \
    npm install -w packages/shared --include=dev --ignore-scripts --no-audit --progress=false && \
    cd packages/shared && \
    npm run build && \
    npm pack && \
    cd ../confusable && \
    npm pack

# -----------------------------------------------------------------------------
# Service: Control Plane
# -----------------------------------------------------------------------------
FROM base AS control-plane
WORKDIR /app

# Copy shared package tarball from builder
COPY --from=shared-builder /app/packages/shared/wbscanner-shared-0.1.0.tgz /app/packages/shared/
COPY --from=shared-builder /app/packages/confusable/confusable-0.1.0.tgz /app/packages/confusable/

# Install dependencies
COPY services/control-plane/package.json services/control-plane/tsconfig.json /app/services/control-plane/
RUN --mount=type=cache,target=/root/.npm \
    cd /app/services/control-plane && \
    npm install /app/packages/shared/wbscanner-shared-0.1.0.tgz --include=dev --no-audit --progress=false && \
    npm install /app/packages/confusable/confusable-0.1.0.tgz --include=dev --no-audit --progress=false && \
    npm install --include=dev --no-audit --progress=false && \
    npm install --include=dev --no-audit --progress=false

# Copy source and build
COPY tsconfig.base.json /app/
COPY types /app/types
COPY services/control-plane/src /app/services/control-plane/src
RUN cd /app/services/control-plane && \
    npm run build

# Install wget for healthcheck (must be done as root)
RUN apt-get update && apt-get install -y wget && rm -rf /var/lib/apt/lists/*

# Setup storage and user
RUN mkdir -p /app/storage && chown -R node:node /app/storage
USER node
WORKDIR /app/services/control-plane

EXPOSE 8080
CMD ["node", "dist/index.js"]

# -----------------------------------------------------------------------------
# Service: Scan Orchestrator
# -----------------------------------------------------------------------------
FROM base AS scan-orchestrator
WORKDIR /app

# Copy shared package tarball from builder
COPY --from=shared-builder /app/packages/shared/wbscanner-shared-0.1.0.tgz /app/packages/shared/
COPY --from=shared-builder /app/packages/confusable/confusable-0.1.0.tgz /app/packages/confusable/

# Install dependencies
COPY services/scan-orchestrator/package.json services/scan-orchestrator/tsconfig.json /app/services/scan-orchestrator/
RUN --mount=type=cache,target=/root/.npm \
    cd /app/services/scan-orchestrator && \
    npm install /app/packages/shared/wbscanner-shared-0.1.0.tgz --include=dev --no-audit --progress=false && \
    npm install /app/packages/confusable/confusable-0.1.0.tgz --include=dev --no-audit --progress=false && \
    npm install --include=dev --no-audit --progress=false --ignore-scripts && \
    npm rebuild esbuild

# Copy source and build
COPY tsconfig.base.json /app/
COPY types /app/types
COPY services/scan-orchestrator/src /app/services/scan-orchestrator/src
RUN cd /app/services/scan-orchestrator && \
    npm run build

# Install wget for healthcheck (must be done as root)
RUN apt-get update && apt-get install -y wget && rm -rf /var/lib/apt/lists/*

# Setup storage and user
RUN mkdir -p /app/storage && chown -R node:node /app/storage
USER node
WORKDIR /app/services/scan-orchestrator

EXPOSE 3001
CMD ["node", "dist/index.js"]

# -----------------------------------------------------------------------------
# Service: WA Client (Builder)
# -----------------------------------------------------------------------------
FROM base AS wa-client-builder
WORKDIR /app

# Copy shared package tarball from builder
COPY --from=shared-builder /app/packages/shared/wbscanner-shared-0.1.0.tgz /app/packages/shared/
COPY --from=shared-builder /app/packages/confusable/confusable-0.1.0.tgz /app/packages/confusable/

# Install dependencies
COPY services/wa-client/package.json services/wa-client/tsconfig.json /app/services/wa-client/
RUN --mount=type=cache,target=/root/.npm \
    cd /app/services/wa-client && \
    npm install /app/packages/shared/wbscanner-shared-0.1.0.tgz --include=dev --no-audit --progress=false && \
    npm install /app/packages/confusable/confusable-0.1.0.tgz --include=dev --no-audit --progress=false && \
    npm install --include=dev --no-audit --progress=false

# Copy source and build
COPY tsconfig.base.json /app/
COPY types /app/types
COPY services/wa-client/src /app/services/wa-client/src
RUN cd /app/services/wa-client && \
    npm run build

# -----------------------------------------------------------------------------
# Service: WA Client (Runtime)
# -----------------------------------------------------------------------------
FROM ghcr.io/puppeteer/puppeteer:22.13.1 AS wa-client
USER root
WORKDIR /app
ENV NODE_ENV=production \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Copy built artifacts from builder
COPY --from=wa-client-builder /app/services/wa-client/package.json /app/services/wa-client/
COPY --from=wa-client-builder /app/services/wa-client/dist /app/services/wa-client/dist
COPY --from=wa-client-builder /app/services/wa-client/node_modules /app/services/wa-client/node_modules
# We also need shared package node_modules if they are not flattened?
# Actually, npm install in wa-client-builder should have everything in wa-client/node_modules or root node_modules?
# Since we are not using workspaces in the builder (we just cd into the dir), node_modules should be in services/wa-client/node_modules.
# However, we installed shared package from tarball, so it's in node_modules.

# Setup storage and user
RUN mkdir -p /app/services/wa-client/data && chown -R pptruser:pptruser /app/services/wa-client
USER pptruser
VOLUME ["/app/services/wa-client/data"]
EXPOSE 3000
WORKDIR /app/services/wa-client
CMD ["node", "dist/index.js"]

# -----------------------------------------------------------------------------
# Service: Migrate
# -----------------------------------------------------------------------------
FROM base AS migrate
WORKDIR /app

# Copy shared package tarball from builder
COPY --from=shared-builder /app/packages/shared/wbscanner-shared-0.1.0.tgz /app/packages/shared/

# Install dependencies
# We need to install the shared package to get its dependencies (including better-sqlite3 if needed)
# But for migration, we might just need pg.
# Let's replicate the original behavior but optimized.
COPY package.json /app/
COPY packages/shared/package.json /app/packages/shared/

# Install dependencies including shared and pg
RUN --mount=type=cache,target=/root/.npm \
    npm install /app/packages/shared/wbscanner-shared-0.1.0.tgz --omit=dev --no-audit --progress=false --ignore-scripts && \
    npm install pg --no-audit --progress=false

# Copy migration script and migrations
COPY scripts/run-migrations.js /app/scripts/
COPY db/migrations /app/db/migrations

# Setup storage
RUN mkdir -p /app/storage && chmod 777 /app/storage

CMD ["node", "scripts/run-migrations.js"]
