module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  coverageProvider: 'v8',
  testMatch: ['**/__tests__/**/*.test.ts'],
  coveragePathIgnorePatterns: ['<rootDir>/src/index.ts'],
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.test.json',
    },
  },
  setupFiles: ['<rootDir>/../../scripts/jest-env-setup.js'],
  moduleNameMapper: {
    '^@wbscanner/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '^@wbscanner/shared/(.*)$': '<rootDir>/../../packages/shared/src/$1',
    '^better-sqlite3$': '<rootDir>/../../packages/shared/__mocks__/better-sqlite3.js',
  },
};
