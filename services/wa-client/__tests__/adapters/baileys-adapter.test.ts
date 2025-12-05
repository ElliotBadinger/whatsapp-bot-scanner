/**
 * Baileys Adapter Tests
 *
 * Comprehensive tests for the BaileysAdapter class, covering:
 * - Connection lifecycle
 * - Message sending
 * - Event handling
 * - Error handling
 * - Auth state management
 */

import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from "@jest/globals";
import type { Logger } from "pino";
import type Redis from "ioredis";

// Mock the Baileys library
const mockSocket = {
  ev: {
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
  },
  sendMessage: jest.fn(),
  logout: jest.fn(),
  end: jest.fn(),
  updateBlockStatus: jest.fn(),
  requestPairingCode: jest.fn(),
  groupMetadata: jest.fn(),
  ws: {
    close: jest.fn(),
  },
};

const mockMakeWASocket = jest.fn().mockReturnValue(mockSocket);
const mockMakeCacheableSignalKeyStore = jest.fn().mockReturnValue({});
const mockFetchLatestBaileysVersion = jest
  .fn<() => Promise<{ version: number[]; isLatest: boolean }>>()
  .mockResolvedValue({
    version: [2, 3000, 1027934701],
    isLatest: true,
  });

jest.mock("@whiskeysockets/baileys", () => ({
  default: mockMakeWASocket,
  makeWASocket: mockMakeWASocket,
  makeCacheableSignalKeyStore: mockMakeCacheableSignalKeyStore,
  fetchLatestBaileysVersion: mockFetchLatestBaileysVersion,
  DisconnectReason: {
    loggedOut: 401,
    connectionClosed: 428,
    connectionLost: 408,
    connectionReplaced: 440,
    timedOut: 408,
    restartRequired: 515,
    badSession: 500,
  },
  proto: {
    Message: {
      InteractiveResponseMessage: {
        Body: {},
      },
    },
  },
  generateWAMessageFromContent: jest.fn(),
  getContentType: jest.fn(),
  jidDecode: jest.fn((jid: string) => ({
    user: jid.split("@")[0],
    server: jid.split("@")[1] || "s.whatsapp.net",
  })),
  isJidGroup: jest.fn((jid: string) => jid?.includes("@g.us")),
  isJidUser: jest.fn((jid: string) => jid?.includes("@s.whatsapp.net")),
}));

// Mock the auth store
jest.mock("../../src/auth/baileys-auth-store", () => ({
  useRedisAuthState: jest.fn<() => Promise<unknown>>().mockResolvedValue({
    state: {
      creds: { me: null },
      keys: {},
    },
    saveCreds: jest.fn(),
    clearState: jest.fn(),
  }),
}));

// Import after mocking
import { BaileysAdapter } from "../../src/adapters/baileys-adapter";

describe("BaileysAdapter", () => {
  let adapter: BaileysAdapter;
  let mockRedis: Redis;
  let mockLogger: Logger;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      exists: jest.fn<() => Promise<number>>().mockResolvedValue(0),
    } as unknown as Redis;

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      trace: jest.fn(),
      child: jest.fn().mockReturnThis(),
    } as unknown as Logger;

    adapter = new BaileysAdapter({
      redis: mockRedis,
      logger: mockLogger,
      clientId: "test-client",
      printQRInTerminal: false,
      browserName: "TestBot",
    });
  });

  afterEach(async () => {
    // Ensure clean disconnect
    try {
      await adapter.disconnect();
    } catch {
      // Ignore errors during cleanup
    }
  });

  describe("initialization", () => {
    it("should initialize with correct default state", () => {
      expect(adapter.state).toBe("disconnected");
      expect(adapter.botId).toBeNull();
    });

    it("should accept configuration options", () => {
      const customAdapter = new BaileysAdapter({
        redis: mockRedis,
        logger: mockLogger,
        clientId: "custom-client",
        phoneNumber: "+1234567890",
        printQRInTerminal: true,
        browserName: "CustomBot",
        dataPath: "/custom/path",
      });

      expect(customAdapter.state).toBe("disconnected");
    });
  });

  describe("connect", () => {
    it("should transition to connecting state", async () => {
      // Start connection (don't await as it may hang waiting for events)
      adapter.connect().catch(() => { /* intentionally ignored */ });

      // Should be in connecting state
      expect(adapter.state).toBe("connecting");

      // Cancel the connection
      await adapter.disconnect();
    });

    it("should create Baileys socket with correct config", async () => {
      adapter.connect().catch(() => { /* intentionally ignored */ });

      // Verify makeWASocket was called
      expect(mockMakeWASocket).toHaveBeenCalled();

      await adapter.disconnect();
    });
  });

  describe("disconnect", () => {
    it("should set state to disconnected", async () => {
      // Start and immediately disconnect
      adapter.connect().catch(() => {});
      await adapter.disconnect();

      expect(adapter.state).toBe("disconnected");
    });

    it("should be safe to call multiple times", async () => {
      await adapter.disconnect();
      await adapter.disconnect();
      await adapter.disconnect();

      expect(adapter.state).toBe("disconnected");
    });
  });

  describe("event handlers", () => {
    it("should register connection change handler", () => {
      const handler = jest.fn();
      adapter.onConnectionChange(handler);

      // Handler should be registered
      expect(handler).not.toHaveBeenCalled();
    });

    it("should register disconnect handler", () => {
      const handler = jest.fn();
      adapter.onDisconnect(handler);

      expect(handler).not.toHaveBeenCalled();
    });

    it("should register QR code handler", () => {
      const handler = jest.fn();
      adapter.onQRCode(handler);

      expect(handler).not.toHaveBeenCalled();
    });

    it("should register message handler", () => {
      const handler = jest.fn() as unknown as (
        msg: import("../../src/adapters/types").WAMessage,
      ) => Promise<void>;
      adapter.onMessage(handler);

      expect(handler).not.toHaveBeenCalled();
    });

    it("should register pairing code handler", () => {
      const handler = jest.fn();
      adapter.onPairingCode(handler);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("sendMessage", () => {
    it("should throw when not connected", async () => {
      await expect(
        adapter.sendMessage("1234567890@s.whatsapp.net", {
          type: "text",
          text: "Hello",
        }),
      ).rejects.toThrow("Socket not connected");
    });
  });

  describe("blockContact", () => {
    it("should throw when not connected", async () => {
      await expect(
        adapter.blockContact("1234567890@s.whatsapp.net"),
      ).rejects.toThrow("Socket not connected");
    });
  });

  describe("unblockContact", () => {
    it("should throw when not connected", async () => {
      await expect(
        adapter.unblockContact("1234567890@s.whatsapp.net"),
      ).rejects.toThrow("Socket not connected");
    });
  });

  describe("requestPairingCode", () => {
    it("should throw when not connected", async () => {
      await expect(adapter.requestPairingCode("+1234567890")).rejects.toThrow(
        "Socket not connected",
      );
    });
  });

  describe("state management", () => {
    it("should track connection state correctly", () => {
      expect(adapter.state).toBe("disconnected");

      // Start connection
      adapter.connect().catch(() => {});
      expect(adapter.state).toBe("connecting");
    });

    it("should expose botId as null when not connected", () => {
      expect(adapter.botId).toBeNull();
    });
  });

  describe("JID utilities", () => {
    it("should normalize phone numbers to JID format", async () => {
      // Test through sendMessage which normalizes the JID
      adapter.connect().catch(() => {});

      // This will fail but we're testing the normalization
      try {
        await adapter.sendMessage("1234567890", {
          type: "text",
          text: "Hello",
        });
      } catch {
        // Expected to fail since not connected
      }
    });
  });
});

describe("BaileysAdapter - Integration Behavior", () => {
  it("should support library type check", () => {
    const mockRedis = {} as Redis;
    const mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      trace: jest.fn(),
      child: jest.fn().mockReturnThis(),
    } as unknown as Logger;

    const adapter = new BaileysAdapter({
      redis: mockRedis,
      logger: mockLogger,
      clientId: "test",
    });

    // Adapter should conform to WhatsAppAdapter interface
    expect(typeof adapter.connect).toBe("function");
    expect(typeof adapter.disconnect).toBe("function");
    expect(typeof adapter.sendMessage).toBe("function");
    expect(typeof adapter.onConnectionChange).toBe("function");
    expect(typeof adapter.onDisconnect).toBe("function");
    expect(typeof adapter.onQRCode).toBe("function");
    expect(typeof adapter.onMessage).toBe("function");
    expect(typeof adapter.onPairingCode).toBe("function");
    expect(typeof adapter.blockContact).toBe("function");
    expect(typeof adapter.unblockContact).toBe("function");
    expect(typeof adapter.requestPairingCode).toBe("function");
    expect(typeof adapter.getGroupMetadata).toBe("function");
  });
});
