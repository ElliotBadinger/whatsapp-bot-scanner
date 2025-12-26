#!/bin/bash
#
# Initial sync setup script for SafeMode-web-app
# This script performs the first sync from monorepo to standalone repo
#

set -e

echo "🔄 SafeMode-web-app Initial Sync Setup"
echo "======================================"
echo

# Check if we're in the monorepo root
if [ ! -d "SafeMode-web-app" ]; then
  echo "❌ Error: Must be run from monorepo root"
  echo "   Current directory: $(pwd)"
  exit 1
fi

# Check if GitHub token is available
if [ -z "$GITHUB_TOKEN" ]; then
  echo "⚠️  Warning: GITHUB_TOKEN not set"
  echo "   You may be prompted for credentials"
  echo
fi

STANDALONE_REPO_URL="https://github.com/ElliotBadinger/SafeMode-web-app.git"
TEMP_DIR="/tmp/safemode-sync-$$"

echo "📥 Cloning standalone repository..."
if [ -n "$GITHUB_TOKEN" ]; then
  git clone "https://x-access-token:${GITHUB_TOKEN}@github.com/ElliotBadinger/SafeMode-web-app.git" "$TEMP_DIR"
else
  git clone "$STANDALONE_REPO_URL" "$TEMP_DIR"
fi

echo
echo "🔍 Checking current state..."
cd "$TEMP_DIR"

# Check if repo is empty or has content
if [ -z "$(ls -A | grep -v '^\.git$')" ]; then
  echo "   Standalone repo is empty - will perform initial sync"
  INITIAL_SYNC=true
else
  echo "   Standalone repo has content - will update"
  INITIAL_SYNC=false
fi

echo
echo "🗑️  Cleaning standalone repo (preserving .git)..."
find . -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +

echo
echo "📋 Copying files from monorepo..."
cp -r "${OLDPWD}/SafeMode-web-app/." .

# Remove .github-standalone and move its contents to .github
if [ -d ".github-standalone" ]; then
  echo "   Setting up .github workflows..."
  mkdir -p .github/workflows
  cp -r .github-standalone/workflows/* .github/workflows/ 2>/dev/null || true
  rm -rf .github-standalone
fi

echo
echo "📝 Configuring git..."
git config user.name "SafeMode Sync Bot"
git config user.email "github-actions[bot]@users.noreply.github.com"

echo
echo "✅ Staging changes..."
git add .

if git diff --cached --quiet; then
  echo "   No changes to commit"
else
  if [ "$INITIAL_SYNC" = true ]; then
    echo "   Committing initial sync..."
    git commit -m "feat: initial sync from monorepo" \
               -m "This repository is automatically synced with the SafeMode-web-app folder in the whatsapp-bot-scanner monorepo." \
               -m "Changes can be made in either repository and will be synced bidirectionally."
  else
    echo "   Committing sync updates..."
    git commit -m "sync: update from monorepo" \
               -m "Synced from whatsapp-bot-scanner monorepo"
  fi
  
  echo
  echo "📤 Pushing to standalone repository..."
  git push origin main
  
  echo
  echo "✅ Initial sync complete!"
fi

echo
echo "🧹 Cleaning up..."
cd "$OLDPWD"
rm -rf "$TEMP_DIR"

echo
echo "======================================"
echo "✅ Setup Complete!"
echo
echo "Next steps:"
echo "1. Configure GitHub secrets (see docs/SAFEMODE_SYNC_SETUP.md)"
echo "2. The sync workflows will run automatically on push"
echo "3. Verify sync at: https://github.com/ElliotBadinger/SafeMode-web-app"
echo
echo "Documentation: docs/SAFEMODE_SYNC_SETUP.md"

