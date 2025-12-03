#!/bin/bash

# Compatibility wrapper for pair.sh
# This script routes to the new unified CLI pair command

# Set the calling script for compatibility detection
export COMPATIBILITY_CALLING_SCRIPT="pair.sh"

# Execute the compatibility wrapper
node ./scripts/cli/core/compatibility.mjs