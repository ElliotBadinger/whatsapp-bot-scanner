module.exports = {
  rootDir: __dirname,
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts"],
  extensionsToTreatAsEsm: [".ts"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tsconfig.test.json",
        useESM: true,
      },
    ],
  },
  setupFiles: ["<rootDir>/../../scripts/jest-env-setup.js"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@wbscanner/shared$": "<rootDir>/__tests__/mocks/wbscanner-shared.ts",
    "^@wbscanner/shared/(.*)$": "<rootDir>/__tests__/mocks/wbscanner-shared.ts",
    "^whatsapp-web\\.js$": "<rootDir>/__tests__/mocks/whatsapp-web-js.ts",
    "better-sqlite3":
      "<rootDir>/../../packages/shared/__mocks__/better-sqlite3.js",
  },
};
