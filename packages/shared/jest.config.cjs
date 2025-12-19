module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  coverageProvider: 'v8',
  roots: ['<rootDir>/src', '<rootDir>/__tests__'],
  testRegex: '(/__tests__/.*|\\.(test|spec))\\.ts$',
  setupFiles: ['<rootDir>/../../scripts/jest-env-setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(ansi-styles|chalk|color-convert|color-name|has-flag|supports-color|pino-pretty|@types)/)'
  ],
  moduleNameMapper: {
    'better-sqlite3': '<rootDir>/__mocks__/better-sqlite3.js'
  },
};
