#!/bin/bash

# DeepSource Configuration Deployment Script
# This script commits and pushes the enhanced DeepSource configuration to GitHub

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}DeepSource Configuration Deployment${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if we're in a git repository
if [ ! -d .git ]; then
    echo -e "${RED}Error: Not in a git repository${NC}"
    exit 1
fi

# Check if .deepsource.toml exists
if [ ! -f .deepsource.toml ]; then
    echo -e "${RED}Error: .deepsource.toml not found${NC}"
    exit 1
fi

# Show current git status
echo -e "${YELLOW}Current Git Status:${NC}"
git status --short
echo ""

# Stage the DeepSource configuration
echo -e "${BLUE}Staging .deepsource.toml...${NC}"
git add .deepsource.toml

# Show what will be committed
echo ""
echo -e "${YELLOW}Changes to be committed:${NC}"
git diff --cached --stat
echo ""

# Create commit message
COMMIT_MSG="feat: enhance DeepSource configuration with comprehensive security scanning

- Added Python analyzer for security and performance scanning
- Enhanced JavaScript/TypeScript analyzer with security and performance plugins
- Configured dependency scanning for npm and Python packages
- Added comprehensive exclude patterns for better analysis coverage
- Configured Docker security scanning with explicit Dockerfile paths
- Enhanced secrets detection with better exclusion patterns
- Improved SQL and shell script security analysis
- Added test coverage tracking with monorepo support
- Configured Prettier transformer with config file reference

This configuration now provides:
- Software Composition Analysis (SCA) for dependencies
- Security vulnerability detection across multiple languages
- Performance anti-pattern detection
- Comprehensive code quality analysis
- Automated code formatting"

# Commit the changes
echo -e "${BLUE}Committing changes...${NC}"
git commit -m "$COMMIT_MSG"

# Check if commit was successful
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Commit successful${NC}"
    echo ""
else
    echo -e "${RED}✗ Commit failed${NC}"
    exit 1
fi

# Get current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo -e "${YELLOW}Current branch: ${CURRENT_BRANCH}${NC}"
echo ""

# Push to remote
echo -e "${BLUE}Pushing to origin/${CURRENT_BRANCH}...${NC}"
git push origin "$CURRENT_BRANCH"

# Check if push was successful
if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}✓ Deployment Successful!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "${YELLOW}Next Steps:${NC}"
    echo "1. DeepSource will automatically detect the updated configuration"
    echo "2. New analyzers will start scanning your codebase"
    echo "3. Check your DeepSource dashboard for results"
    echo ""
    echo -e "${BLUE}Enhanced Security Features:${NC}"
    echo "  • Python security & performance analysis"
    echo "  • JavaScript/TypeScript security plugins"
    echo "  • Dependency vulnerability scanning (SCA)"
    echo "  • Docker security best practices"
    echo "  • Secrets detection"
    echo "  • SQL injection detection"
    echo "  • Shell script security analysis"
    echo ""
else
    echo ""
    echo -e "${RED}✗ Push failed${NC}"
    echo -e "${YELLOW}You may need to pull changes first or check your remote configuration${NC}"
    exit 1
fi
