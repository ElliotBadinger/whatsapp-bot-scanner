/**
 * Adapter Factory Tests (Baileys-only)
 */

import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from "@jest/globals";

const BaileysAdapter = jest.fn().mockImplementation(() => ({
  state: "disconnected",
  botId: null,
  connect: jest.fn(),
  disconnect: jest.fn(),
}));

jest.unstable_mockModule("../../src/adapters/baileys-adapter.js", () => ({
  __esModule: true,
  BaileysAdapter,
}));

import type Redis from "ioredis";
import type { Logger } from "pino";

describe("Adapter Factory", () => {
  const mockRedis = {} as Redis;
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn().mockReturnThis(),
  } as unknown as Logger;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.WA_LIBRARY;
  });

  afterEach(() => {
    delete process.env.WA_LIBRARY;
  });

  const importFactory = async () => {
    return import("../../src/adapters/factory");
  };

  describe("getConfiguredLibrary", () => {
    it("returns baileys when WA_LIBRARY is not set", () => {
      return importFactory().then(({ getConfiguredLibrary }) => {
        expect(getConfiguredLibrary()).toBe("baileys");
      });
    });

    it("returns baileys regardless of WA_LIBRARY (wwebjs is no longer supported)", () => {
      process.env.WA_LIBRARY = "wwebjs";
      return importFactory().then(({ getConfiguredLibrary }) => {
        expect(getConfiguredLibrary()).toBe("baileys");
      });
    });
  });

  describe("createWhatsAppAdapter", () => {
    it("creates a BaileysAdapter", async () => {
      const { createWhatsAppAdapter } = await importFactory();
      const adapter = await createWhatsAppAdapter({
        library: "baileys",
        redis: mockRedis,
        logger: mockLogger,
        clientId: "test-client",
      });

      expect(BaileysAdapter).toHaveBeenCalled();
      expect(adapter).toBeDefined();
    });

    it("passes configuration to BaileysAdapter", async () => {
      const { createWhatsAppAdapter } = await importFactory();
      await createWhatsAppAdapter({
        library: "baileys",
        redis: mockRedis,
        logger: mockLogger,
        clientId: "test-client",
        phoneNumber: "+1234567890",
        printQRInTerminal: false,
        browserName: "TestBot",
      });

      expect(BaileysAdapter).toHaveBeenCalledWith(
        expect.objectContaining({
          redis: mockRedis,
          clientId: "test-client",
          phoneNumber: "+1234567890",
          printQRInTerminal: false,
          browserName: "TestBot",
        }),
      );
    });
  });

  describe("LIBRARY_INFO", () => {
    it("has info for baileys", () => {
      return importFactory().then(({ LIBRARY_INFO }) => {
        expect(LIBRARY_INFO.baileys).toBeDefined();
        expect(LIBRARY_INFO.baileys.name).toBe("Baileys");
        expect(LIBRARY_INFO.baileys.recommended).toBe(true);
      });
    });
  });
});
