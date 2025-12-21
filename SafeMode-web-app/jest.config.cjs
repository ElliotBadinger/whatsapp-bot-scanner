/** @type {import('jest').Config} */
module.exports = {
  rootDir: __dirname,
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts"],
  extensionsToTreatAsEsm: [".ts", ".tsx"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tsconfig.json",
        useESM: true,
      },
    ],
  },
  moduleNameMapper: {
    "^server-only$": "<rootDir>/test-utils/server-only.ts",
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@/(.*)$": "<rootDir>/$1",
  },
};
