#!/usr/bin/env node

import { runSetup } from './setup/orchestrator.mjs';

runSetup().catch(error => {
  console.error(error?.stack || error?.message || 'Unexpected error in setup wizard.');
  process.exit(1);
});
