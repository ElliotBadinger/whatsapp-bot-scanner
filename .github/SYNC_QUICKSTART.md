# SafeMode Sync - Quick Start Guide

## 🚀 Initial Setup (One-Time)

### 1. Create GitHub Personal Access Token

1. Go to: https://github.com/settings/tokens/new
2. Name: `SafeMode Sync Token`
3. Select scopes:
   - ✅ `repo` (Full control of private repositories)
   - ✅ `workflow` (Update GitHub Action workflows)
4. Click "Generate token" and **copy it**

### 2. Add Token to Monorepo

1. Go to: https://github.com/ElliotBadinger/whatsapp-bot-scanner/settings/secrets/actions
2. Click "New repository secret"
3. Name: `SAFEMODE_SYNC_TOKEN`
4. Value: Paste your token
5. Click "Add secret"

### 3. Run Initial Sync

```bash
cd /home/epistemophile/Development/whatsapp-bot-scanner

# Set your token (optional, for automated push)
export GITHUB_TOKEN="your_token_here"

# Run the initial sync script
./scripts/sync-safemode-initial.sh
```

### 4. (Optional) Setup Webhook in Standalone Repo

For instant syncs from standalone → monorepo:

1. Go to standalone repo: https://github.com/ElliotBadinger/SafeMode-web-app
2. Add the same token as secret: `MONOREPO_SYNC_TOKEN`
3. The `.github/workflows/notify-monorepo.yml` file will be created automatically during first sync

## ✅ Verify Setup

1. Check monorepo Actions: https://github.com/ElliotBadinger/whatsapp-bot-scanner/actions
2. Check standalone Actions: https://github.com/ElliotBadinger/SafeMode-web-app/actions
3. Make a test commit in either repo and watch it sync!

## 📝 Daily Usage

### Working in Monorepo
```bash
cd SafeMode-web-app
# Make changes
git add .
git commit -m "feat(SafeMode-web-app): your feature"
git push origin main
# ✅ Auto-syncs to standalone repo in ~1 min
```

### Working in Standalone Repo
```bash
git clone https://github.com/ElliotBadinger/SafeMode-web-app.git
cd SafeMode-web-app
# Make changes
git add .
git commit -m "feat: your feature"
git push origin main
# ✅ Auto-syncs to monorepo in ~15 min (or ~1 min with webhook)
```

## 🔧 Manual Sync

Trigger manually via GitHub Actions UI:
1. Go to: https://github.com/ElliotBadinger/whatsapp-bot-scanner/actions
2. Select workflow: "Sync SafeMode to Standalone Repo (Push)" or "(Pull)"
3. Click "Run workflow" → Select `main` → "Run workflow"

## 📚 Full Documentation

See [`docs/SAFEMODE_SYNC_SETUP.md`](../docs/SAFEMODE_SYNC_SETUP.md) for:
- Detailed troubleshooting
- Conflict resolution
- Architecture notes
- Best practices

## ❓ Quick Troubleshooting

**Sync not working?**
- Check token is set correctly
- Verify token hasn't expired
- Check Actions logs for errors
- Ensure you're pushing to `main` branch

**Need help?**
Check workflow logs or open an issue!

