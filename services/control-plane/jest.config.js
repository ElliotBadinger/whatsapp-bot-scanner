module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  coverageProvider: "v8",
  testMatch: ["**/__tests__/**/*.test.ts"],
  globals: {
    "ts-jest": {
      tsconfig: "<rootDir>/tsconfig.test.json",
    },
  },
  setupFiles: ["<rootDir>/../../scripts/jest-env-setup.js"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@wbscanner/shared$": "<rootDir>/../../packages/shared/src/index.ts",
    "^@wbscanner/shared/(.*)$": "<rootDir>/../../packages/shared/src/$1",
  },
};
