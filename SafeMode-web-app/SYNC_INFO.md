# 🔄 Repository Sync Information

This folder is **automatically synchronized** with a standalone repository:
**https://github.com/ElliotBadinger/SafeMode-web-app**

## Bidirectional Sync

Changes made in either location will be automatically synced:

- **Monorepo → Standalone**: Immediate (on push to `main`)
- **Standalone → Monorepo**: Every 15 minutes (or instant with webhook)

## Working on SafeMode

You can work in either repository:

### Option 1: Work in Monorepo (Recommended)
```bash
cd SafeMode-web-app
# Make changes
git add .
git commit -m "feat(SafeMode-web-app): your feature"
git push origin main
```

Changes automatically sync to the standalone repo within ~1 minute.

### Option 2: Work in Standalone Repo
```bash
git clone https://github.com/ElliotBadinger/SafeMode-web-app.git
cd SafeMode-web-app
# Make changes
git add .
git commit -m "feat: your feature"
git push origin main
```

Changes sync back to the monorepo within 15 minutes (or instantly with webhook).

## Why Two Repos?

- **Monorepo**: Integration with backend services, shared packages, coordinated releases
- **Standalone**: Independent deployments, simpler CI/CD, isolated development

## Documentation

Full setup and troubleshooting guide:
**`docs/SAFEMODE_SYNC_SETUP.md`**

## Status

Check sync status:
- [Monorepo Actions](https://github.com/ElliotBadinger/whatsapp-bot-scanner/actions)
- [Standalone Actions](https://github.com/ElliotBadinger/SafeMode-web-app/actions)

