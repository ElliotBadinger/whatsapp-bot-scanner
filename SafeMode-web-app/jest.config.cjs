/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/__tests__"],
  testRegex: "(/__tests__/.*|\\.(test|spec))\\.ts$",
  moduleNameMapper: {
    "^server-only$": "<rootDir>/__tests__/mocks/server-only.js",
  },
  globals: {
    "ts-jest": {
      tsconfig: "<rootDir>/tsconfig.jest.json",
    },
  },
};
