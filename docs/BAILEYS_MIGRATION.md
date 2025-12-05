# Baileys Migration Guide

This document describes the dual-library architecture that allows switching between Baileys and whatsapp-web.js for WhatsApp connectivity.

## Overview

The WBScanner now supports two WhatsApp libraries:

| Library | Type | RAM Usage | Browser Required | Recommended |
|---------|------|-----------|------------------|-------------|
| **Baileys** | Protocol-based | ~50MB | No | ✅ Yes |
| whatsapp-web.js | Browser-based | ~500MB | Yes (Chromium) | No |

## Quick Start

### Using Baileys (Recommended)

```bash
# Set in .env
WA_LIBRARY=baileys

# Or run with environment variable
WA_LIBRARY=baileys npm run dev:adapter --workspace services/wa-client
```

### Using whatsapp-web.js (Legacy)

```bash
# Set in .env
WA_LIBRARY=wwebjs

# Or use the legacy entry point
npm run dev --workspace services/wa-client
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WA_LIBRARY` | `baileys` | WhatsApp library to use (`baileys` or `wwebjs`) |
| `WA_HTTP_PORT` | `3001` | HTTP port for health checks and metrics |
| `WA_AUTH_STRATEGY` | `remote` | Authentication strategy (`local` or `remote`) |
| `WA_AUTH_CLIENT_ID` | `default` | Client ID for session storage |

### Setup Wizard

Run the setup wizard to configure the library interactively:

```bash
./setup.sh
```

The wizard will prompt you to select between Baileys and whatsapp-web.js.

## Architecture

### Adapter Pattern

The new architecture uses an adapter pattern to abstract the WhatsApp library:

```
┌─────────────────────────────────────────────────────────┐
│                    WhatsAppAdapter                       │
│                    (Interface)                           │
├─────────────────────────────────────────────────────────┤
│  connect()  │  disconnect()  │  sendMessage()  │  ...   │
└──────────────────────┬──────────────────────────────────┘
                       │
         ┌─────────────┴─────────────┐
         │                           │
┌────────▼────────┐       ┌──────────▼──────────┐
│  BaileysAdapter │       │   WWebJSAdapter     │
│  (Protocol)     │       │   (Browser)         │
└─────────────────┘       └─────────────────────┘
```

### Key Files

- `services/wa-client/src/adapters/types.ts` - Common interface definitions
- `services/wa-client/src/adapters/baileys-adapter.ts` - Baileys implementation
- `services/wa-client/src/adapters/wwebjs-adapter.ts` - whatsapp-web.js implementation
- `services/wa-client/src/adapters/factory.ts` - Adapter factory
- `services/wa-client/src/main.ts` - New adapter-based entry point
- `services/wa-client/src/handlers/message-handler.ts` - Shared message handling

## Entry Points

### Adapter-based (New)

Use `main.ts` for the new adapter-based architecture:

```bash
# Development
npm run dev:adapter --workspace services/wa-client

# Production
npm run start:adapter --workspace services/wa-client
```

### Legacy (whatsapp-web.js only)

Use `index.ts` for the legacy whatsapp-web.js-only entry point:

```bash
# Development
npm run dev --workspace services/wa-client
```

## Migration Steps

### From whatsapp-web.js to Baileys

1. **Update environment**:
   ```bash
   # In .env
   WA_LIBRARY=baileys
   ```

2. **Clear old session** (optional but recommended):
   ```bash
   # Delete old whatsapp-web.js session data
   rm -rf data/remote-session
   ```

3. **Switch entry point**:
   ```bash
   # Use the new adapter-based entry point
   npm run dev:adapter --workspace services/wa-client
   ```

4. **Re-authenticate**:
   - Scan the QR code or use phone number pairing
   - Session will be stored in Redis with Baileys format

### Rollback to whatsapp-web.js

If you need to rollback:

1. **Update environment**:
   ```bash
   WA_LIBRARY=wwebjs
   ```

2. **Use legacy entry point**:
   ```bash
   npm run dev --workspace services/wa-client
   ```

## Verification Checklist

After migration, verify:

- [ ] Service starts without errors
- [ ] QR code or pairing code is displayed
- [ ] Authentication succeeds
- [ ] Messages are received
- [ ] URLs are extracted and queued for scanning
- [ ] Bot commands work (`!scanner help`, `!scanner status`)
- [ ] Health endpoint returns healthy status (`/health`)
- [ ] Metrics are exposed (`/metrics`)

## Troubleshooting

### Common Issues

**1. "Socket not connected" error**
- Ensure Redis is running and accessible
- Check `REDIS_URL` environment variable
- Verify network connectivity between containers

**2. QR code not appearing**
- Check `WA_REMOTE_AUTH_DISABLE_QR_FALLBACK` is not set to `true`
- Ensure terminal supports QR code display

**3. Session not persisting**
- Verify Redis connection
- Check `WA_AUTH_CLIENT_ID` is consistent
- Ensure Redis data is not being cleared

**4. Docker networking issues**
- Run `scripts/fix-waydroid-nftables.sh` if using Waydroid
- Check firewalld configuration
- Verify inter-container connectivity

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=debug npm run dev:adapter --workspace services/wa-client
```

## Pre-flight Check

Run the pre-flight check before starting:

```bash
node scripts/preflight-check.mjs
```

This verifies:
- Node.js version
- Required environment variables
- Package dependencies
- Redis connectivity
- Docker networking (if applicable)

## Security Notes

- Both adapters use Redis for session storage with encryption
- Baileys sessions are stored with the `baileys:auth:` prefix
- whatsapp-web.js sessions use the `remoteauth:v1:` prefix
- Sessions are encrypted using the `WA_REMOTE_AUTH_DATA_KEY`

## Performance Comparison

| Metric | Baileys | whatsapp-web.js |
|--------|---------|-----------------|
| Startup time | ~2s | ~10-30s |
| Memory usage | ~50MB | ~500MB |
| CPU usage | Low | Medium-High |
| Dependencies | Minimal | Puppeteer + Chromium |
| Container size | ~200MB | ~1.5GB |

## Support

For issues related to this migration:
1. Check the troubleshooting section above
2. Run the pre-flight check
3. Review logs with debug level enabled
4. Open an issue on GitHub with relevant logs
