#!/bin/bash
# Git pre-commit hook to run type validation
# Install: ln -s ../../scripts/pre-commit.sh .git/hooks/pre-commit

echo "Running pre-commit type validation..."

# Run the validation script
./scripts/validate-types.sh

# Capture exit code
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
    echo ""
    echo "❌ Pre-commit validation failed!"
    echo "   Please fix the errors above before committing."
    echo "   To skip this hook (not recommended), use: git commit --no-verify"
    exit 1
fi

echo "✅ Pre-commit validation passed!"
exit 0
