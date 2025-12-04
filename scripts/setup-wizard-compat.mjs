#!/usr/bin/env node

/**
 * Compatibility wrapper for setup-wizard.mjs
 * This script routes to the new unified CLI setup command
 */

import { createCompatibilityWrapper } from "./cli/core/compatibility.mjs";

// Set the calling script for compatibility detection
process.env.COMPATIBILITY_CALLING_SCRIPT = "setup-wizard.mjs";

// Create and run the compatibility wrapper
const runCompatibility = createCompatibilityWrapper("setup-wizard.mjs");
runCompatibility();
