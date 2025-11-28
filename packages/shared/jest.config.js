module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/__tests__'],
  testRegex: '(/__tests__/.*|\\.(test|spec))\\.ts$',
  setupFiles: ['<rootDir>/../../scripts/jest-env-setup.js'],
};
