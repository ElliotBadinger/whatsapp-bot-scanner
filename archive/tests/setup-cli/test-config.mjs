import { defineConfig } from 'vitest/config';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(fileURLToPath(import.meta.url));
const enableUi = process.env.VITEST_UI === '1';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.mjs'],
    exclude: ['**/node_modules/**', '**/.git/**'],
    // Test coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.mjs'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/*.d.ts',
        '**/test-utils.mjs',
        '**/test-config.mjs'
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80
      },
      waterlines: [80, 90],
      all: true
    },
    // Test reporting configuration
    reporters: ['default', 'json'],
    outputFile: {
      json: './test-results.json'
    },
    // Test timeout configuration
    testTimeout: 30000,
    hookTimeout: 10000,
    // Test retry configuration
    retries: 2,
    // Test parallelization
    threads: true,
    maxThreads: 4,
    minThreads: 1,
    // Test environment variables
    env: {
      NODE_ENV: 'test',
      TEST_MODE: 'true'
    },
    // Test setup and teardown
    setupFiles: ['./test-setup.mjs'],
    globalSetup: ['./test-global-setup.mjs'],
    // Test watch mode configuration
    watch: false,
    // Test UI configuration
    ui: enableUi,
    // Test snapshot configuration
    snapshotFormat: {
      escapeString: true,
      printBasicPrototype: true
    },
    // Test mock configuration
    unstubEnvs: true,
    unstubGlobals: true,
    // Test isolation configuration
    isolate: true,
    // Test sequence configuration
    sequence: {
      shuffle: false,
      seed: 42
    }
  },
  resolve: {
    alias: {
      'execa': 'execa',
      'chalk': 'chalk',
      'enquirer': 'enquirer',
      'ora': 'ora',
      'boxen': 'boxen'
    }
  }
});
