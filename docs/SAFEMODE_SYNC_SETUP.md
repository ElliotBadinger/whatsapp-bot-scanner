# SafeMode-web-app Bidirectional Sync Setup

This document explains how the perpetual sync between the monorepo's `SafeMode-web-app` folder and the standalone [SafeMode-web-app repository](https://github.com/ElliotBadinger/SafeMode-web-app) works.

## Overview

The sync system uses GitHub Actions to automatically synchronize changes bidirectionally:

- **Push Sync**: Changes to `SafeMode-web-app/` in the monorepo → Standalone repo
- **Pull Sync**: Changes in the standalone repo → Monorepo's `SafeMode-web-app/` folder

## Workflows

### 1. Push Sync (`.github/workflows/sync-safemode-push.yml`)

**Triggers:**

- Automatic: When commits are pushed to `main` branch that modify `SafeMode-web-app/**`
- Manual: Via GitHub Actions UI (workflow_dispatch)

**What it does:**

1. Checks out the monorepo
2. Clones the standalone SafeMode-web-app repository
3. Syncs all files from `SafeMode-web-app/` folder to the standalone repo
4. Commits and pushes changes with the original commit message
5. Adds a note indicating it was synced from the monorepo

### 2. Pull Sync (`.github/workflows/sync-safemode-pull.yml`)

**Triggers:**

- Automatic: Every 15 minutes (scheduled cron job)
- Manual: Via GitHub Actions UI (workflow_dispatch)
- Webhook: Via repository_dispatch event `safemode-update`

**What it does:**

1. Checks out the monorepo
2. Clones the standalone SafeMode-web-app repository
3. Syncs all files from the standalone repo back to `SafeMode-web-app/` folder
4. Preserves `node_modules/`, `.next/`, and `.vercel/` directories
5. Commits and pushes changes with the original commit message
6. Adds a note indicating it was synced from the standalone repo

## Setup Requirements

### GitHub Token Configuration

For the sync to work with proper permissions, you need to configure a Personal Access Token (PAT):

1. **Create a GitHub Personal Access Token:**
   - Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Click "Generate new token (classic)"
   - Name it: `SafeMode Sync Token`
   - Select scopes:
     - `repo` (Full control of private repositories)
     - `workflow` (Update GitHub Action workflows)
   - Generate and copy the token

2. **Add Token as Repository Secret:**
   - Go to monorepo settings: https://github.com/ElliotBadinger/whatsapp-bot-scanner/settings/secrets/actions
   - Click "New repository secret"
   - Name: `SAFEMODE_SYNC_TOKEN`
   - Value: Paste the token
   - Click "Add secret"

3. **Add Token to Standalone Repo (for webhook, optional):**
   - Go to standalone repo settings: https://github.com/ElliotBadinger/SafeMode-web-app/settings/secrets/actions
   - Add the same token as `MONOREPO_SYNC_TOKEN`

### Optional: Webhook Setup (Faster Pull Sync)

Instead of relying on the 15-minute cron schedule, you can set up a webhook for instant pull syncs:

1. **In the standalone SafeMode-web-app repo**, create `.github/workflows/notify-monorepo.yml`:

```yaml
name: Notify Monorepo of Changes

on:
  push:
    branches:
      - main

jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger monorepo sync
        run: |
          curl -X POST \
            -H "Accept: application/vnd.github.v3+json" \
            -H "Authorization: token ${{ secrets.MONOREPO_SYNC_TOKEN }}" \
            https://api.github.com/repos/ElliotBadinger/whatsapp-bot-scanner/dispatches \
            -d '{"event_type":"safemode-update"}'
```

This will trigger the pull sync workflow immediately when changes are pushed to the standalone repo.

## Usage

### Developing in the Monorepo

1. Make changes to `SafeMode-web-app/` folder
2. Commit and push to `main` branch
3. The push sync workflow automatically runs
4. Changes appear in the standalone repo within ~1 minute

### Developing in the Standalone Repo

1. Clone and work on https://github.com/ElliotBadinger/SafeMode-web-app
2. Commit and push changes
3. Within 15 minutes (or instantly with webhook), changes sync back to monorepo
4. Changes appear in the monorepo's `SafeMode-web-app/` folder

### Manual Sync

You can manually trigger either workflow:

1. Go to Actions tab in the monorepo
2. Select "Sync SafeMode to Standalone Repo (Push)" or "Sync SafeMode from Standalone Repo (Pull)"
3. Click "Run workflow"
4. Select branch (usually `main`)
5. Click "Run workflow"

## Conflict Resolution

### Preventing Conflicts

- **Work in one repo at a time** for a given feature
- **Pull latest changes** before starting work
- **Commit frequently** to minimize large merges

### Handling Conflicts

If both repos are modified simultaneously:

1. The workflow will fail with merge conflicts
2. Manually resolve:

   ```bash
   # In monorepo
   cd SafeMode-web-app
   git remote add standalone https://github.com/ElliotBadinger/SafeMode-web-app.git
   git fetch standalone
   git merge standalone/main
   # Resolve conflicts
   git add .
   git commit
   git push origin main
   ```

3. Re-run the failed workflow

## Monitoring

### Check Sync Status

- **Monorepo Actions**: https://github.com/ElliotBadinger/whatsapp-bot-scanner/actions
- **Standalone Actions**: https://github.com/ElliotBadinger/SafeMode-web-app/actions

### Notifications

GitHub will email you if a workflow fails. You can also:

1. Enable Slack/Discord notifications via Actions
2. Use GitHub mobile app for real-time alerts
3. Check the Actions badge in your README

## Troubleshooting

### Workflow Not Running

- **Check branch name**: Workflows only run on `main` branch
- **Verify token**: Ensure `SAFEMODE_SYNC_TOKEN` is properly set
- **Check token expiration**: PATs expire; regenerate if needed

### Sync Failures

- **Review workflow logs** in the Actions tab
- **Check for conflicts** in git status
- **Verify permissions** on both repositories
- **Ensure token has correct scopes**: `repo` and `workflow`

### Partial Syncs

If some files don't sync:

- Check `.gitignore` in both repos
- Verify file paths are correct
- Look for symbolic links or special characters

## Best Practices

1. **Always pull before pushing** when working in either repo
2. **Use feature branches** for experimental work
3. **Test in standalone repo first** for SafeMode-specific features
4. **Keep monorepo as source of truth** for architecture changes
5. **Document breaking changes** in commit messages
6. **Review sync commits** periodically to ensure quality

## Disabling Sync

To temporarily disable sync:

1. Go to Actions → Select workflow
2. Click the "..." menu → Disable workflow
3. Re-enable when ready

To permanently remove sync:

1. Delete `.github/workflows/sync-safemode-push.yml`
2. Delete `.github/workflows/sync-safemode-pull.yml`
3. Commit and push

## Architecture Notes

### Why This Approach?

- **git subtree split**: Complex for contributors, hard to maintain
- **git submodule**: Points to commits, not true sync
- **GitHub Actions**: Simple, visible, auditable, and flexible

### Sync Direction Priority

- Both directions are equal priority
- Last commit wins (no automatic conflict resolution)
- Manual intervention required for complex conflicts

### Performance

- Push sync: ~30-60 seconds after commit
- Pull sync:
  - With webhook: ~30-60 seconds
  - Without webhook: Up to 15 minutes (cron schedule)
  - Manual trigger: Immediate

---

**Need help?** Check workflow logs or open an issue in the monorepo.
