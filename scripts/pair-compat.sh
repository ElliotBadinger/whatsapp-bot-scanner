#!/bin/bash

# Compatibility wrapper for pair.sh
# This script routes to the new unified CLI pair command

# Set the calling script for compatibility detection
export COMPATIBILITY_CALLING_SCRIPT="pair.sh"

# Execute the compatibility wrapper (prefer bun over node)
if command -v bun &> /dev/null; then
    bun ./scripts/cli/core/compatibility.mjs
else
    node ./scripts/cli/core/compatibility.mjs
fi