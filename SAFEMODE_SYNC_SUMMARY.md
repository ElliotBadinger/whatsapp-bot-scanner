# 🔄 SafeMode Sync Setup - Complete Summary

## ✅ What Has Been Set Up

Your monorepo now has **perpetual bidirectional synchronization** between:

- **Source**: `SafeMode-web-app/` folder in this monorepo
- **Target**: https://github.com/ElliotBadinger/SafeMode-web-app (standalone repo)

## 📋 Files Created

### GitHub Actions Workflows

1. **`.github/workflows/sync-safemode-push.yml`**
   - Syncs changes FROM monorepo TO standalone repo
   - Triggers: Push to `main` branch that modifies `SafeMode-web-app/**`
   - Speed: ~30-60 seconds after commit

2. **`.github/workflows/sync-safemode-pull.yml`**
   - Syncs changes FROM standalone repo TO monorepo
   - Triggers: Every 15 minutes (cron) + manual + webhook
   - Speed: Up to 15 minutes (or instant with webhook)

### Documentation

3. **`docs/SAFEMODE_SYNC_SETUP.md`** (Comprehensive Guide)
   - Complete setup instructions
   - Token configuration
   - Troubleshooting guide
   - Conflict resolution
   - Best practices

4. **`.github/SYNC_QUICKSTART.md`** (Quick Reference)
   - Fast setup steps
   - Daily usage examples
   - Quick troubleshooting

5. **`SafeMode-web-app/SYNC_INFO.md`**
   - Developer-facing sync information
   - Placed in the synced folder for visibility

### Setup Scripts

6. **`scripts/sync-safemode-initial.sh`** (Executable)
   - Performs the first sync to standalone repo
   - Sets up workflows in standalone repo
   - Handles both empty and existing repos

### Configuration

7. **`SafeMode-web-app/.github-standalone/workflows/notify-monorepo.yml`**
   - Webhook workflow for standalone repo
   - Will be moved to standalone's `.github/` during first sync
   - Triggers instant pull syncs

8. **Updated `.gitignore`**
   - Ignores Next.js build artifacts (`.next/`, `.vercel/`, `out/`)

9. **Updated `README.md`**
   - Added SafeMode-web-app section
   - Links to sync documentation

## 🚀 Next Steps (Required)

### Step 1: Create GitHub Personal Access Token

1. Visit: https://github.com/settings/tokens/new
2. Name: `SafeMode Sync Token`
3. Expiration: Choose duration (recommend: 90 days or No expiration for testing)
4. Select scopes:
   - ✅ **`repo`** (Full control of private repositories)
   - ✅ **`workflow`** (Update GitHub Action workflows)
5. Click "Generate token"
6. **Copy the token immediately** (you won't see it again!)

### Step 2: Add Token to Monorepo Secrets

1. Go to: https://github.com/ElliotBadinger/whatsapp-bot-scanner/settings/secrets/actions
2. Click "New repository secret"
3. Name: `SAFEMODE_SYNC_TOKEN`
4. Value: Paste your token from Step 1
5. Click "Add secret"

### Step 3: Run Initial Sync

```bash
cd /home/epistemophile/Development/whatsapp-bot-scanner

# Export your token (for initial push)
export GITHUB_TOKEN="your_token_here"

# Run the initial sync script
./scripts/sync-safemode-initial.sh
```

This will:

- Clone the standalone repo
- Copy all files from `SafeMode-web-app/`
- Set up workflows in the standalone repo
- Push the initial commit

### Step 4: Merge to Main (When Ready)

The workflows are configured to run on the `main` branch. When you're ready:

```bash
git checkout main
git merge experimentation
git push origin main
```

### Step 5: Verify Setup

1. Check monorepo actions: https://github.com/ElliotBadinger/whatsapp-bot-scanner/actions
2. Check standalone actions: https://github.com/ElliotBadinger/SafeMode-web-app/actions
3. Make a test commit and watch it sync!

## 🔧 Optional: Setup Webhook (Instant Sync)

For instant syncs from standalone → monorepo (instead of 15-minute delay):

1. Go to: https://github.com/ElliotBadinger/SafeMode-web-app/settings/secrets/actions
2. Add the same token as: `MONOREPO_SYNC_TOKEN`
3. The workflow is already in place (will be created during initial sync)

## 📊 How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                     BIDIRECTIONAL SYNC                      │
└─────────────────────────────────────────────────────────────┘

Monorepo (whatsapp-bot-scanner)          Standalone Repo
SafeMode-web-app/                        SafeMode-web-app
       │                                        │
       │ ──── Push to main ───────────────────>│
       │      (sync-safemode-push.yml)          │
       │      ~30-60 seconds                    │
       │                                        │
       │<─────── Push to main ─────────────────│
       │      (sync-safemode-pull.yml)          │
       │      ~1 min (webhook) or               │
       │      ~15 min (cron)                    │
       │                                        │
```

### Sync Behavior

**Push Sync (Monorepo → Standalone):**

- Triggered by commits to `main` that modify `SafeMode-web-app/**`
- Copies entire folder contents to standalone repo
- Preserves commit messages with "sync:" prefix
- Adds note: "Synced from whatsapp-bot-scanner monorepo"

**Pull Sync (Standalone → Monorepo):**

- Triggered every 15 minutes by cron schedule
- Also triggered by webhook (instant)
- Copies standalone repo contents to `SafeMode-web-app/` folder
- Preserves `node_modules/`, `.next/`, `.vercel/` directories
- Adds note: "Synced from standalone repo"

## 📝 Daily Usage

### Developing in Monorepo (Recommended)

```bash
cd SafeMode-web-app
# Make changes
npm run dev  # Test locally
git add .
git commit -m "feat(SafeMode-web-app): add new feature"
git push origin main
# ✅ Auto-syncs to standalone in ~1 minute
```

### Developing in Standalone Repo

```bash
git clone https://github.com/ElliotBadinger/SafeMode-web-app.git
cd SafeMode-web-app
# Make changes
npm run dev  # Test locally
git add .
git commit -m "feat: add new feature"
git push origin main
# ✅ Auto-syncs to monorepo in ~1 minute (webhook) or ~15 minutes (cron)
```

## 🛠️ Manual Sync

If you need to trigger sync manually:

1. Go to: https://github.com/ElliotBadinger/whatsapp-bot-scanner/actions
2. Select:
   - "Sync SafeMode to Standalone Repo (Push)" for monorepo → standalone
   - "Sync SafeMode from Standalone Repo (Pull)" for standalone → monorepo
3. Click "Run workflow"
4. Select `main` branch
5. Click "Run workflow"

## ⚠️ Important Notes

### Conflict Prevention

- **Work in one repo at a time** for a given feature
- **Always pull latest** before starting work
- **Don't make simultaneous changes** in both repos

### What Gets Synced

- ✅ All source files (`.ts`, `.tsx`, `.js`, `.jsx`)
- ✅ Configuration files (`package.json`, `tsconfig.json`, etc.)
- ✅ Public assets
- ✅ Documentation (`.md` files)
- ❌ `node_modules/` (git ignored)
- ❌ `.next/` build artifacts (git ignored)
- ❌ `.vercel/` deployment artifacts (git ignored)
- ❌ `.git/` directories

### Branch Configuration

- Syncs only happen on `main` branch
- Feature branches are not synced
- This prevents sync noise during development

## 📚 Documentation Reference

- **Comprehensive Setup**: `docs/SAFEMODE_SYNC_SETUP.md`
- **Quick Start**: `.github/SYNC_QUICKSTART.md`
- **Sync Info**: `SafeMode-web-app/SYNC_INFO.md`
- **Main README**: `README.md` (updated with SafeMode section)

## 🐛 Troubleshooting

### "Workflow not running"

- Check you're pushing to `main` branch
- Verify `SAFEMODE_SYNC_TOKEN` is set correctly
- Check token hasn't expired

### "Sync failed"

- Review workflow logs in Actions tab
- Check for merge conflicts
- Verify token has `repo` and `workflow` scopes

### "Changes not syncing"

- Check `.gitignore` in both repos
- Verify file paths are correct
- Look for errors in Actions logs

## 📞 Support

For detailed troubleshooting, see `docs/SAFEMODE_SYNC_SETUP.md`.

For questions or issues, check the workflow logs:

- Monorepo: https://github.com/ElliotBadinger/whatsapp-bot-scanner/actions
- Standalone: https://github.com/ElliotBadinger/SafeMode-web-app/actions

---

## ✨ Summary

You now have a fully configured bidirectional sync system! Once you complete the setup steps above, any changes you make in either repository will automatically sync to the other.

**Status**:

- ✅ Workflows created
- ✅ Documentation complete
- ✅ Setup script ready
- ⏳ Awaiting token configuration (Steps 1-3)
- ⏳ Awaiting merge to main (Step 4)

**Current Branch**: `experimentation` (commit `ae9077a` pushed)
**Next Action**: Follow Steps 1-5 above to complete setup

Enjoy your synchronized SafeMode-web-app! 🚀
