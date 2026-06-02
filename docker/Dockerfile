# syntax=docker/dockerfile:1.4

# =============================================================================
# Base stage with Bun
# =============================================================================
FROM oven/bun:1.3-slim AS base
WORKDIR /app
ENV NODE_ENV=production

# =============================================================================
# Shared Builder Stage - Builds packages/shared once
# =============================================================================
FROM base AS shared-builder
WORKDIR /app

# Copy root config
COPY tsconfig.base.json /app/
COPY types /app/types

# Copy confusable package (complete)
COPY packages/confusable /app/packages/confusable

# Copy shared package source
COPY packages/shared/package.json packages/shared/tsconfig.json /app/packages/shared/
COPY packages/shared/src /app/packages/shared/src

# Install dependencies and build shared package
# Build each package independently without workspace resolution
# Replace confusable file reference before building shared package
RUN --mount=type=cache,target=/root/.bun/install/cache \
  set -e && \
  cd /app/packages/confusable && bun install --ignore-scripts && bun pm pack && \
  cd /app/packages/shared && \
  sed -i 's|"confusable": "file:../confusable"|"confusable": "file:/app/packages/confusable/confusable-0.1.0.tgz"|g' package.json && \
  bun install --ignore-scripts && \
  rm -rf /app/node_modules && ln -s /app/packages/shared/node_modules /app/node_modules && \
  bun run build && bun pm pack

# =============================================================================
# Scanner Core Builder Stage - Builds packages/scanner-core once
# =============================================================================
FROM base AS scanner-core-builder
WORKDIR /app

# Copy root config
COPY tsconfig.base.json /app/
COPY types /app/types

# Copy scanner-core package source
COPY packages/scanner-core/package.json packages/scanner-core/tsconfig.json /app/packages/scanner-core/
COPY packages/scanner-core/src /app/packages/scanner-core/src

# Copy shared package tarball from builder
COPY --from=shared-builder /app/packages/shared/*.tgz /app/packages/shared/
COPY --from=shared-builder /app/packages/confusable/*.tgz /app/packages/confusable/

# Install dependencies and build scanner-core
RUN --mount=type=cache,target=/root/.bun/install/cache \
  cd /app/packages/scanner-core && \
  sed -i 's|"@wbscanner/shared": "file:../shared"|"@wbscanner/shared": "file:/app/packages/shared/wbscanner-shared-0.1.0.tgz"|g' package.json && \
  bun install --ignore-scripts && \
  rm -rf /app/node_modules && ln -s /app/packages/scanner-core/node_modules /app/node_modules && \
  bun run build && bun pm pack

# =============================================================================
# Service: WA Client (Builder)
# =============================================================================
FROM base AS wa-client-builder
WORKDIR /app

# Install build tools for better-sqlite3 native compilation (need node-gyp)
RUN apt-get update -o Acquire::Retries=3 -o Acquire::ForceIPv4=true && \
  apt-get install -y --no-install-recommends python3 make g++ nodejs npm && \
  npm install -g node-gyp && \
  rm -rf /var/lib/apt/lists/*

# Copy shared package tarball from builder
COPY --from=shared-builder /app/packages/shared/*.tgz /app/packages/shared/
COPY --from=shared-builder /app/packages/confusable/*.tgz /app/packages/confusable/
COPY --from=scanner-core-builder /app/packages/scanner-core/*.tgz /app/packages/scanner-core/

# Install ALL dependencies (including dev) to build
COPY services/wa-client/package.json services/wa-client/tsconfig.json /app/services/wa-client/
# Replace workspace references with tarball paths, then install
RUN --mount=type=cache,target=/root/.bun/install/cache \
  cd /app/services/wa-client && \
  sed -i 's|"@wbscanner/shared": "file:../../packages/shared"|"@wbscanner/shared": "file:/app/packages/shared/wbscanner-shared-0.1.0.tgz"|g' package.json && \
  sed -i 's|"@wbscanner/scanner-core": "file:../../packages/scanner-core"|"@wbscanner/scanner-core": "file:/app/packages/scanner-core/wbscanner-scanner-core-0.1.0.tgz"|g' package.json && \
  sed -i 's|"confusable": "file:../../packages/confusable"|"confusable": "file:/app/packages/confusable/confusable-0.1.0.tgz"|g' package.json && \
  bun install && \
  rm -rf /app/node_modules && ln -s /app/services/wa-client/node_modules /app/node_modules

# Copy source and build
COPY tsconfig.base.json /app/
COPY types /app/types
COPY services/wa-client/src /app/services/wa-client/src
RUN cd /app/services/wa-client && bun run build

# =============================================================================
# Service: WA Client - Baileys (Lightweight Production Dependencies)
# Baileys doesn't need puppeteer or chromium - much smaller image
# =============================================================================
FROM base AS wa-client-baileys-prod-deps
WORKDIR /app

# Install build tools for better-sqlite3 native compilation (need node-gyp)
RUN apt-get update -o Acquire::Retries=3 -o Acquire::ForceIPv4=true && \
  apt-get install -y --no-install-recommends python3 make g++ nodejs npm && \
  npm install -g node-gyp && \
  rm -rf /var/lib/apt/lists/*

# Copy shared package tarball from builder
COPY --from=shared-builder /app/packages/shared/*.tgz /app/packages/shared/
COPY --from=shared-builder /app/packages/confusable/*.tgz /app/packages/confusable/
COPY --from=scanner-core-builder /app/packages/scanner-core/*.tgz /app/packages/scanner-core/

# Copy package.json and install production dependencies (Baileys, no Chromium)
COPY services/wa-client/package.json /app/services/wa-client/
RUN --mount=type=cache,target=/root/.bun/install/cache \
  cd /app/services/wa-client && \
  sed -i 's|"@wbscanner/shared": "file:../../packages/shared"|"@wbscanner/shared": "file:/app/packages/shared/wbscanner-shared-0.1.0.tgz"|g' package.json && \
  sed -i 's|"@wbscanner/scanner-core": "file:../../packages/scanner-core"|"@wbscanner/scanner-core": "file:/app/packages/scanner-core/wbscanner-scanner-core-0.1.0.tgz"|g' package.json && \
  sed -i 's|"confusable": "file:../../packages/confusable"|"confusable": "file:/app/packages/confusable/confusable-0.1.0.tgz"|g' package.json && \
  bun install --production

# =============================================================================
# Service: WA Client - Baileys (Final Lightweight Runtime)
# Uses slim base image without Puppeteer/Chromium (~500MB smaller)
# =============================================================================
FROM base AS wa-client-baileys
WORKDIR /app
ENV NODE_ENV=production \
  WA_LIBRARY=baileys

RUN apt-get update -o Acquire::Retries=3 -o Acquire::ForceIPv4=true && \
  apt-get install -y --no-install-recommends nodejs ca-certificates && \
  rm -rf /var/lib/apt/lists/*

# Copy production node_modules from baileys-specific prod-deps stage
COPY --from=wa-client-baileys-prod-deps /app/services/wa-client/node_modules /app/services/wa-client/node_modules

# Copy built artifacts from builder stage
COPY --from=wa-client-builder /app/services/wa-client/dist /app/services/wa-client/dist
COPY --from=wa-client-builder /app/services/wa-client/package.json /app/services/wa-client/

# Copy entrypoint script
COPY services/wa-client/scripts/entrypoint.sh /app/services/wa-client/entrypoint.sh

# Setup storage and user
RUN mkdir -p /app/services/wa-client/data /app/storage && \
  chmod +x /app/services/wa-client/entrypoint.sh && \
  chown -R bun:bun /app/services/wa-client /app/storage
USER bun
VOLUME ["/app/services/wa-client/data"]
EXPOSE 3000 3005
WORKDIR /app/services/wa-client
CMD ["./entrypoint.sh"]

# =============================================================================
# Service: Migrate
# =============================================================================
FROM base AS migrate
WORKDIR /app

# Install build tools for better-sqlite3 native compilation
RUN apt-get update && apt-get install -y python3 make g++ nodejs npm && \
  npm install -g node-gyp && \
  rm -rf /var/lib/apt/lists/*

# Copy shared package tarball from builder
COPY --from=shared-builder /app/packages/shared/*.tgz /app/packages/shared/
COPY --from=shared-builder /app/packages/confusable/*.tgz /app/packages/confusable/

# Install dependencies including shared (production only)
RUN --mount=type=cache,target=/root/.bun/install/cache \
  set -e && \
  printf '{"name":"wbscanner-migrate","private":true,"version":"0.0.0"}\n' > /app/package.json && \
  bun add /app/packages/confusable/*.tgz && \
  bun add better-sqlite3 pg && \
  bun add /app/packages/shared/*.tgz && \
  bun install --production

# Copy migration script and migrations
COPY scripts/run-migrations.js /app/scripts/
COPY db/migrations /app/db/migrations

# Setup storage with proper ownership for bun user (UID 1000)
# This ensures SQLite database files are accessible by all services
RUN mkdir -p /app/storage && chown -R bun:bun /app/storage && chmod 755 /app/storage

# Run migrations as bun user for consistent file ownership
USER bun

ENTRYPOINT []
CMD ["node", "scripts/run-migrations.js"]
