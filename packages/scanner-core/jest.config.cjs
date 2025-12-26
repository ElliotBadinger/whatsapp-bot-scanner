module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testRegex: "(/__tests__/.*|\\.(test|spec))\\.ts$",
  moduleNameMapper: {
    "^@wbscanner/shared$": "<rootDir>/../shared/src",
    "^@wbscanner/shared/(.*)$": "<rootDir>/../shared/src/$1",
  },
  globals: {
    "ts-jest": {
      tsconfig: "<rootDir>/tsconfig.json",
      useESM: false,
    },
  },
};
