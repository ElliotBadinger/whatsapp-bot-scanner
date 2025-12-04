# Docker Build Fix for GitHub Codespaces

## Problem

Setup was failing in new environments like GitHub Codespaces with the following error:

```
src/homoglyph.ts(1,41): error TS2307: Cannot find module 'confusable' or its corresponding type declarations.
```

## Root Cause

The `shared-builder` stage in the Dockerfile had two issues:

1. **Module Resolution**: The `confusable` package dependencies weren't installed before trying to build `shared`, which imports from `confusable`
2. **Missing TypeScript Binary**: The `--ignore-scripts` flag prevented npm from installing the TypeScript compiler binary (`tsc`)

## Solution

Modified `docker/Dockerfile` in the `shared-builder` stage:

### Before
```dockerfile
COPY packages/confusable /app/packages/confusable
COPY packages/shared/package.json packages/shared/tsconfig.json /app/packages/shared/
COPY packages/shared/src /app/packages/shared/src

RUN --mount=type=cache,target=/root/.npm \
    npm install -w packages/shared --include=dev --ignore-scripts --no-audit --progress=false && \
    cd packages/shared && \
    npm run build && \
    npm pack && \
    cd ../confusable && \
    npm pack
```

### After
```dockerfile
# Copy confusable package (complete)
COPY packages/confusable /app/packages/confusable

# Copy shared package source
COPY packages/shared/package.json packages/shared/tsconfig.json /app/packages/shared/
COPY packages/shared/src /app/packages/shared/src

# Install confusable dependencies first (so confusables.js is available)
# Then install shared dependencies (which links to confusable via file:../confusable)
# Finally build shared and pack both
RUN --mount=type=cache,target=/root/.npm \
    cd /app/packages/confusable && npm install --no-audit --progress=false && \
    cd /app && npm install -w packages/shared --include=dev --no-audit --progress=false && \
    cd /app/packages/shared && npm run build && npm pack && \
    cd /app/packages/confusable && npm pack
```

## Key Changes

1. **Install confusable first**: Run `npm install` in the confusable package directory to install its dependency (`confusables.js`)
2. **Remove `--ignore-scripts`**: Allow npm to install dev dependency binaries like TypeScript
3. **Proper sequencing**: Install confusable → install shared → build shared → pack both

## Testing

To test the fix locally:

```bash
docker build -f docker/Dockerfile --target shared-builder -t test-shared-builder .
```

Or test the full build:

```bash
make build
# or
docker-compose build
```

## Notes

- The fix ensures the `confusable` package is fully set up before TypeScript tries to compile `shared`
- The `shared` package depends on `confusable` via `file:../confusable` in its package.json
- Network issues in Codespaces may still cause intermittent failures, but the module resolution issue is fixed
