/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/packages', '<rootDir>/services', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
  collectCoverageFrom: [
    '**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/__tests__/**',
    '!**/dist/**',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 90,
      statements: 90,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@wbscanner/shared$': '<rootDir>/packages/shared/src/index.ts',
    '^@wbscanner/shared/(.*)$': '<rootDir>/packages/shared/src/$1',
    '^@wbscanner/scanner-core$': '<rootDir>/packages/scanner-core/src/index.ts',
    '^@wbscanner/scanner-core/(.*)$': '<rootDir>/packages/scanner-core/src/$1',
    '^better-sqlite3$': '<rootDir>/packages/shared/__mocks__/better-sqlite3.js',
  },
  testTimeout: 10000,
  maxWorkers: '50%',
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};
