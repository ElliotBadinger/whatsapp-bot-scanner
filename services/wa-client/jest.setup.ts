import { jest } from "@jest/globals";

jest.mock("@wbscanner/shared", () => {
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn().mockReturnThis(),
  };

  const register = {
    contentType: "text/plain; version=0.0.4",
    metrics: jest.fn(async () => ""),
  };

  const metrics = {
    waQrCodesGenerated: { inc: jest.fn() },
    waStateChanges: { labels: jest.fn(() => ({ inc: jest.fn() })) },
    waConsecutiveAuthFailures: { labels: jest.fn(() => ({ set: jest.fn() })) },
  };

  const config = {
    queues: {
      scanRequest: "scan-request",
    },
    wa: {
      authStrategy: "remote",
      qrTerminal: false,
      remoteAuth: {
        clientId: "default",
        phoneNumbers: [],
        disableQrFallback: false,
        dataPath: "./data",
        backupIntervalMs: 60_000,
      },
    },
  };

  return {
    __esModule: true,
    config,
    logger,
    register,
    metrics,
    assertEssentialConfig: jest.fn(),
    assertControlPlaneToken: jest.fn(),
    createRedisConnection: jest.fn(() => ({})),
    connectRedis: jest.fn(async () => undefined),
  };
});
