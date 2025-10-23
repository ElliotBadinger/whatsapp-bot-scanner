module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  moduleNameMapper: {
    '^@wbscanner/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '^@wbscanner/shared/(.*)$': '<rootDir>/../../packages/shared/src/$1',
  },
};
