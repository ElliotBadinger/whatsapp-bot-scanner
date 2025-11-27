process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.URLSCAN_CALLBACK_SECRET =
  process.env.URLSCAN_CALLBACK_SECRET || "test-secret";
process.env.CONTROL_PLANE_API_TOKEN =
  process.env.CONTROL_PLANE_API_TOKEN || "test-token";
process.env.VT_API_KEY = process.env.VT_API_KEY || "test-vt-key";
process.env.GSB_API_KEY = process.env.GSB_API_KEY || "test-gsb-key";
process.env.WHOISXML_API_KEY = process.env.WHOISXML_API_KEY || "test-whois-key";
process.env.REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379/0";
process.env.SQLITE_DB_PATH =
  process.env.SQLITE_DB_PATH || "./storage/wbscanner.db";
process.env.SCAN_REQUEST_QUEUE =
  process.env.SCAN_REQUEST_QUEUE || "scan-request";
process.env.WA_REMOTE_AUTH_DATA_KEY =
  process.env.WA_REMOTE_AUTH_DATA_KEY ||
  Buffer.from("jest-remote-auth-key-placeholder-32", "utf8").toString("base64");

jest.mock("ioredis", () => {
  const Redis = require("ioredis-mock");
  return {
    __esModule: true,
    default: Redis,
    ...Redis,
  };
});

jest.mock("bullmq", () => {
  const queueAdd = jest.fn().mockResolvedValue(undefined);
  const Queue = jest.fn().mockImplementation(() => ({
    add: queueAdd,
    on: jest.fn(),
  }));
  const Worker = jest.fn();
  return { Queue, Worker };
});
