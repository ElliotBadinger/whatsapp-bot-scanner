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
    bun run build && bun pm pack

# =============================================================================
# Service: Control Plane (Builder)
# =============================================================================
FROM base AS control-plane-builder
WORKDIR /app

# Install build tools for better-sqlite3 native compilation
RUN apt-get update && apt-get install -y python3 make g++ wget && rm -rf /var/lib/apt/lists/*

# Copy shared package tarball from builder
COPY --from=shared-builder /app/packages/shared/*.tgz /app/packages/shared/
COPY --from=shared-builder /app/packages/confusable/*.tgz /app/packages/confusable/

# Install ALL dependencies (including dev) to build
COPY services/control-plane/package.json services/control-plane/tsconfig.json /app/services/control-plane/
RUN --mount=type=cache,target=/root/.bun/install/cache \
    cd /app/services/control-plane && \
    sed -i 's|"@wbscanner/shared": "file:../../packages/shared"|"@wbscanner/shared": "file:/app/packages/shared/wbscanner-shared-0.1.0.tgz"|g' package.json && \
    bun install && \
    python3 -c "import json; p='package.json'; data=json.load(open(p)); open(p,'w').write(json.dumps(data, indent=2, sort_keys=False) + '\n')"

# Copy source and build
COPY tsconfig.base.json /app/
COPY types /app/types
COPY services/control-plane/src /app/services/control-plane/src
RUN cd /app/services/control-plane && bun run build

# =============================================================================
# Service: Control Plane (Production)
# =============================================================================
FROM base AS control-plane-prod-deps
WORKDIR /app

# Install build tools for better-sqlite3 native compilation
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy shared package tarball from builder
COPY --from=shared-builder /app/packages/shared/*.tgz /app/packages/shared/
COPY --from=shared-builder /app/packages/confusable/*.tgz /app/packages/confusable/

# Install PRODUCTION dependencies only
COPY services/control-plane/package.json /app/services/control-plane/
RUN --mount=type=cache,target=/root/.bun/install/cache \
    cd /app/services/control-plane && \
    sed -i 's|"@wbscanner/shared": "file:../../packages/shared"|"@wbscanner/shared": "file:/app/packages/shared/wbscanner-shared-0.1.0.tgz"|g' package.json && \
    bun install --production && \
    python3 -c "import json; p='package.json'; data=json.load(open(p)); open(p,'w').write(json.dumps(data, indent=2, sort_keys=False) + '\n')"

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
RUN mkdir -p /app/storage && chown -R bun:bun /app/storage
USER bun
WORKDIR /app/services/control-plane

EXPOSE 8080
CMD ["bun", "run", "dist/index.js"]

# =============================================================================
# Service: Scan Orchestrator (Builder)
# =============================================================================
FROM base AS scan-orchestrator-builder
WORKDIR /app

# Install build tools for better-sqlite3 native compilation
RUN apt-get update && apt-get install -y python3 make g++ wget && rm -rf /var/lib/apt/lists/*

# Copy shared package tarball from builder
COPY --from=shared-builder /app/packages/shared/*.tgz /app/packages/shared/
COPY --from=shared-builder /app/packages/confusable/*.tgz /app/packages/confusable/

# Install ALL dependencies (including dev) to build
COPY services/scan-orchestrator/package.json services/scan-orchestrator/tsconfig.json /app/services/scan-orchestrator/
RUN --mount=type=cache,target=/root/.bun/install/cache \
    cd /app/services/scan-orchestrator && \
    sed -i 's|"@wbscanner/shared": "file:../../packages/shared"|"@wbscanner/shared": "file:/app/packages/shared/wbscanner-shared-0.1.0.tgz"|g' package.json && \
    bun install && \
    python3 -c "import json; p='package.json'; data=json.load(open(p)); open(p,'w').write(json.dumps(data, indent=2, sort_keys=False) + '\n')"

# Copy source and build
COPY tsconfig.base.json /app/
COPY types /app/types
COPY services/scan-orchestrator/src /app/services/scan-orchestrator/src
RUN cd /app/services/scan-orchestrator && bun run build

# =============================================================================
# Service: Scan Orchestrator (Production Dependencies)
# =============================================================================
FROM base AS scan-orchestrator-prod-deps
WORKDIR /app

# Install build tools for better-sqlite3 native compilation
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy shared package tarball from builder
COPY --from=shared-builder /app/packages/shared/*.tgz /app/packages/shared/
COPY --from=shared-builder /app/packages/confusable/*.tgz /app/packages/confusable/

# Install PRODUCTION dependencies only
COPY services/scan-orchestrator/package.json /app/services/scan-orchestrator/
RUN --mount=type=cache,target=/root/.bun/install/cache \
    cd /app/services/scan-orchestrator && \
    sed -i 's|"@wbscanner/shared": "file:../../packages/shared"|"@wbscanner/shared": "file:/app/packages/shared/wbscanner-shared-0.1.0.tgz"|g' package.json && \
    bun install --production && \
    python3 -c "import json; p='package.json'; data=json.load(open(p)); open(p,'w').write(json.dumps(data, indent=2, sort_keys=False) + '\n')"

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
RUN mkdir -p /app/storage && chown -R bun:bun /app/storage
USER bun
WORKDIR /app/services/scan-orchestrator

EXPOSE 3001
CMD ["bun", "run", "dist/index.js"]

# =============================================================================
# Service: WA Client (Builder)
# =============================================================================
FROM base AS wa-client-builder
WORKDIR /app

# Install build tools for better-sqlite3 native compilation (need node-gyp)
RUN apt-get update && apt-get install -y python3 make g++ nodejs npm && \
    npm install -g node-gyp && \
    rm -rf /var/lib/apt/lists/*

# Copy shared package tarball from builder
COPY --from=shared-builder /app/packages/shared/*.tgz /app/packages/shared/
COPY --from=shared-builder /app/packages/confusable/*.tgz /app/packages/confusable/

# Install ALL dependencies (including dev) to build
# Copy scripts first for postinstall hook (patches whatsapp-web.js)
COPY services/wa-client/package.json services/wa-client/tsconfig.json /app/services/wa-client/
COPY services/wa-client/scripts /app/services/wa-client/scripts
# Replace workspace references with tarball paths, then install
RUN --mount=type=cache,target=/root/.bun/install/cache \
    cd /app/services/wa-client && \
    sed -i 's|"@wbscanner/shared": "file:../../packages/shared"|"@wbscanner/shared": "file:/app/packages/shared/wbscanner-shared-0.1.0.tgz"|g' package.json && \
    sed -i 's|"confusable": "file:../../packages/confusable"|"confusable": "file:/app/packages/confusable/confusable-0.1.0.tgz"|g' package.json && \
    bun install

# Copy source and build
COPY tsconfig.base.json /app/
COPY types /app/types
COPY services/wa-client/src /app/services/wa-client/src
RUN cd /app/services/wa-client && bun run build

# =============================================================================
# Service: WA Client (Production Dependencies)
# =============================================================================
FROM base AS wa-client-prod-deps
WORKDIR /app

# Install build tools for better-sqlite3 native compilation (need node-gyp)
RUN apt-get update && apt-get install -y python3 make g++ nodejs npm && \
    npm install -g node-gyp && \
    rm -rf /var/lib/apt/lists/*

# Copy shared package tarball from builder
COPY --from=shared-builder /app/packages/shared/*.tgz /app/packages/shared/
COPY --from=shared-builder /app/packages/confusable/*.tgz /app/packages/confusable/

# Install PRODUCTION dependencies only
# Copy scripts first for postinstall hook (patches whatsapp-web.js)
COPY services/wa-client/package.json /app/services/wa-client/
COPY services/wa-client/scripts /app/services/wa-client/scripts
# Remove workspace references before installing, then add tarballs
RUN --mount=type=cache,target=/root/.bun/install/cache \
    cd /app/services/wa-client && \
    sed -i 's|"@wbscanner/shared": "file:../../packages/shared"|"@wbscanner/shared": "file:/app/packages/shared/wbscanner-shared-0.1.0.tgz"|g' package.json && \
    sed -i 's|"confusable": "file:../../packages/confusable"|"confusable": "file:/app/packages/confusable/confusable-0.1.0.tgz"|g' package.json && \
    bun install --production

# =============================================================================
# Service: WA Client - Baileys (Lightweight Production Dependencies)
# Baileys doesn't need puppeteer or chromium - much smaller image
# =============================================================================
FROM base AS wa-client-baileys-prod-deps
WORKDIR /app

# Install build tools for better-sqlite3 native compilation (need node-gyp)
RUN apt-get update && apt-get install -y python3 make g++ nodejs npm && \
    npm install -g node-gyp && \
    rm -rf /var/lib/apt/lists/*

# Copy shared package tarball from builder
COPY --from=shared-builder /app/packages/shared/*.tgz /app/packages/shared/
COPY --from=shared-builder /app/packages/confusable/*.tgz /app/packages/confusable/

# Copy package.json and filter out whatsapp-web.js (not needed for Baileys)
COPY services/wa-client/package.json /app/services/wa-client/
COPY services/wa-client/scripts /app/services/wa-client/scripts
RUN --mount=type=cache,target=/root/.bun/install/cache \
    cd /app/services/wa-client && \
    sed -i 's|"@wbscanner/shared": "file:../../packages/shared"|"@wbscanner/shared": "file:/app/packages/shared/wbscanner-shared-0.1.0.tgz"|g' package.json && \
    sed -i 's|"confusable": "file:../../packages/confusable"|"confusable": "file:/app/packages/confusable/confusable-0.1.0.tgz"|g' package.json && \
    sed -i '/"whatsapp-web.js":/d' package.json && \
    bun install --production

# =============================================================================
# Service: WA Client - Baileys (Final Lightweight Runtime)
# Uses slim base image without Puppeteer/Chromium (~500MB smaller)
# =============================================================================
FROM base AS wa-client-baileys
WORKDIR /app
ENV NODE_ENV=production \
    WA_LIBRARY=baileys

 RUN apt-get update && apt-get install -y nodejs && rm -rf /var/lib/apt/lists/*

# Copy production node_modules from baileys-specific prod-deps stage
COPY --from=wa-client-baileys-prod-deps /app/services/wa-client/node_modules /app/services/wa-client/node_modules

# Copy built artifacts from builder stage
COPY --from=wa-client-builder /app/services/wa-client/dist /app/services/wa-client/dist
COPY --from=wa-client-builder /app/services/wa-client/package.json /app/services/wa-client/

# Copy entrypoint script for library selection
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
# Service: WA Client - WWebJS (Final Runtime with Puppeteer)
# Note: WA Client uses puppeteer base image which requires Node.js and Chromium
# =============================================================================
FROM ghcr.io/puppeteer/puppeteer:22.13.1 AS wa-client
USER root
WORKDIR /app
ENV NODE_ENV=production \
    WA_LIBRARY=wwebjs \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Install bun in puppeteer image
RUN curl -fsSL https://bun.sh/install | bash && \
    ln -s /root/.bun/bin/bun /usr/local/bin/bun

# Copy production node_modules from prod-deps stage
COPY --from=wa-client-prod-deps /app/services/wa-client/node_modules /app/services/wa-client/node_modules

# Copy built artifacts from builder stage
COPY --from=wa-client-builder /app/services/wa-client/dist /app/services/wa-client/dist
COPY --from=wa-client-builder /app/services/wa-client/package.json /app/services/wa-client/

# Copy entrypoint script for library selection
COPY services/wa-client/scripts/entrypoint.sh /app/services/wa-client/entrypoint.sh

# Setup storage and user
RUN mkdir -p /app/services/wa-client/data /app/storage && \
    chmod +x /app/services/wa-client/entrypoint.sh && \
    chown -R pptruser:pptruser /app/services/wa-client /app/storage
USER pptruser
VOLUME ["/app/services/wa-client/data"]
EXPOSE 3000 3005
WORKDIR /app/services/wa-client
# Entrypoint routes to index.js (wwebjs) or main.js (baileys) based on WA_LIBRARY
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

# Setup storage
RUN mkdir -p /app/storage && chmod 777 /app/storage

ENTRYPOINT []
CMD ["node", "scripts/run-migrations.js"]
