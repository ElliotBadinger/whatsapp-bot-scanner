import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import pino from "pino";
import type Redis from "ioredis";
import FakeRedis from "./fake-redis";
import { SharedMessageHandler } from "../handlers/message-handler";
import type { WAMessage, WhatsAppAdapter } from "../adapters/types";
import type { ScanRequestQueue } from "../types/scanQueue";

describe("SharedMessageHandler", () => {
  const logger = pino({ enabled: false });
  let adapter: WhatsAppAdapter;
  let redis: Redis;
  let scanRequestQueue: ScanRequestQueue;

  beforeEach(() => {
    adapter = {
      state: "ready",
      botId: "12345@c.us",
      connect: jest.fn(),
      disconnect: jest.fn(),
      sendMessage: jest.fn(),
      reply: jest.fn(async () => ({
        messageId: "reply-1",
        timestamp: Date.now(),
        success: true,
      })),
      react: jest.fn(),
      deleteMessage: jest.fn(),
      getGroupMetadata: jest.fn(),
      isOnWhatsApp: jest.fn(),
      requestPairingCode: jest.fn(),
      onMessage: jest.fn(),
      onConnectionChange: jest.fn(),
      onDisconnect: jest.fn(),
      onQRCode: jest.fn(),
      onPairingCode: jest.fn(),
    } as unknown as WhatsAppAdapter;
    redis = new FakeRedis() as unknown as Redis;
    scanRequestQueue = {
      add: jest.fn(),
    } as unknown as ScanRequestQueue;
  });

  it("handles @bot commands the same as !scanner commands", async () => {
    const handler = new SharedMessageHandler({
      adapter,
      redis,
      logger,
      scanRequestQueue,
    });
    const message: WAMessage = {
      id: "msg-1",
      chatId: "chat-1",
      senderId: "user-1",
      body: "@12345 status",
      isGroup: true,
      timestamp: Date.now(),
      fromMe: false,
      mentionedIds: ["12345@c.us"],
      raw: {},
    };

    await handler.createHandler()(message);

    expect(adapter.reply).toHaveBeenCalledWith(
      message,
      expect.objectContaining({
        type: "text",
        text: expect.stringContaining("WBScanner Status"),
      }),
    );
  });

  it("ignores mention commands when the bot mention is not the prefix", async () => {
    const handler = new SharedMessageHandler({
      adapter,
      redis,
      logger,
      scanRequestQueue,
    });
    const message: WAMessage = {
      id: "msg-2",
      chatId: "chat-1",
      senderId: "user-2",
      body: "hello @12345 status",
      isGroup: true,
      timestamp: Date.now(),
      fromMe: false,
      mentionedIds: ["12345@c.us"],
      raw: {},
    };

    await handler.createHandler()(message);

    expect(adapter.reply).not.toHaveBeenCalled();
  });

  it("handles !scanner commands when the bot is mentioned in the same message", async () => {
    const handler = new SharedMessageHandler({
      adapter,
      redis,
      logger,
      scanRequestQueue,
    });
    const message: WAMessage = {
      id: "msg-3",
      chatId: "chat-1",
      senderId: "user-3",
      body: "hello @12345 !scanner status",
      isGroup: true,
      timestamp: Date.now(),
      fromMe: false,
      mentionedIds: ["12345@c.us"],
      raw: {},
    };

    await handler.createHandler()(message);

    expect(adapter.reply).toHaveBeenCalledWith(
      message,
      expect.objectContaining({
        type: "text",
        text: expect.stringContaining("WBScanner Status"),
      }),
    );
  });
});
