import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import type { Client } from "whatsapp-web.js";
import { config, __setPrivateHostnameResult } from "@wbscanner/shared";
import { __testables, formatGroupVerdict } from "../index";

const makeJob = () => ({
  chatId: "chat-1",
  messageId: "msg-1",
  verdict: "suspicious",
  reasons: ["reason-a", "reason-b"],
  url: "https://example.com/path",
  urlHash: "hash-123",
  redirectChain: ["https://example.com", "https://example.com/path"],
  shortener: { provider: "tiny", chain: ["https://t.co/abc"] },
});

describe("wa-client index helpers", () => {
  const redis = __testables.redis as {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string, ...args: unknown[]) => Promise<unknown>;
    del: (key: string) => Promise<unknown>;
    clear?: () => void;
  };

  const resetRedis = () => {
    if (typeof redis.clear === "function") {
      redis.clear();
      return;
    }
    // Fallback for non-FakeRedis implementations
    return redis.del("*");
  };

  beforeEach(() => {
    resetRedis();
    __testables.setSessionSnapshotForTests("ready", "bot@c.us");
    __testables.setPairingContextForTests({ pairingOrchestrator: null });
    __setPrivateHostnameResult(false);
    config.features.attachMediaToVerdicts = true;
  });

  afterEach(() => {
    delete (global as typeof globalThis & { fetch?: typeof fetch }).fetch;
    jest.restoreAllMocks();
  });

  it("caches and reads pairing codes", async () => {
    await __testables.cachePairingCode("15551234567", "123-456");
    const cached = await __testables.getCachedPairingCode("15551234567");
    expect(cached?.code).toBe("123-456");
    expect(typeof cached?.storedAt).toBe("number");
  });

  it("returns null for invalid pairing cache payloads", async () => {
    await redis.set("wa:pairing:code:15551234567", "not-json");
    const cached = await __testables.getCachedPairingCode("15551234567");
    expect(cached).toBeNull();
  });

  it("records and reads pairing attempt timestamps", async () => {
    const ts = Date.now();
    await __testables.recordPairingAttempt("15551230000", ts);
    const read = await __testables.getLastPairingAttempt("15551230000");
    expect(read).toBe(ts);
  });

  it("handles consent lifecycle and membership tracking", async () => {
    await __testables.markConsentPending("chat-1");
    expect(await __testables.getConsentStatus("chat-1")).toBe("pending");

    await __testables.markConsentGranted("chat-1");
    expect(await __testables.getConsentStatus("chat-1")).toBe("granted");

    await __testables.clearConsentState("chat-1");
    expect(await __testables.getConsentStatus("chat-1")).toBeNull();

    await __testables.addPendingMembership("chat-1", "user-1", Date.now());
    await __testables.addPendingMembership("chat-1", "user-2", Date.now());
    const pending = await __testables.listPendingMemberships("chat-1");
    expect(pending.sort()).toEqual(["user-1", "user-2"]);

    await __testables.removePendingMembership("chat-1", "user-1");
    const remaining = await __testables.listPendingMemberships("chat-1");
    expect(remaining).toEqual(["user-2"]);
  });

  it("expands wid variants and builds context keys", () => {
    expect(__testables.expandWidVariants(undefined)).toEqual([]);
    expect(__testables.expandWidVariants("user")).toEqual(["user"]);
    expect(__testables.expandWidVariants("user@c.us")).toEqual([
      "user@c.us",
      "user@lid",
    ]);
    expect(__testables.expandWidVariants("user@lid")).toEqual([
      "user@lid",
      "user@c.us",
    ]);

    const context = { chatId: "chat-1", messageId: "msg-1", urlHash: "hash-1" };
    expect(__testables.contextKey(context)).toBe("chat-1:msg-1:hash-1");
  });

  it("normalizes control-plane base URLs and validates protocols", () => {
    process.env.CONTROL_PLANE_BASE = "http://example.com/scan/";
    expect(__testables.resolveControlPlaneBase()).toBe(
      "http://example.com/scan",
    );

    process.env.CONTROL_PLANE_BASE = "ftp://bad.example.com";
    expect(__testables.resolveControlPlaneBase()).toBe(
      "http://control-plane:8080",
    );
  });

  it("validates URL scanning allow-list rules", async () => {
    __setPrivateHostnameResult(true);
    await expect(
      __testables.isUrlAllowedForScanning("https://example.com"),
    ).resolves.toBe(false);

    __setPrivateHostnameResult(false);
    await expect(
      __testables.isUrlAllowedForScanning("https://example.com:99999"),
    ).resolves.toBe(false);

    await expect(
      __testables.isUrlAllowedForScanning("https://example.com"),
    ).resolves.toBe(true);

    await expect(
      __testables.isUrlAllowedForScanning("not-a-url"),
    ).resolves.toBe(false);
  });

  it("builds IOC text and attachments", () => {
    const lines = __testables.buildIocTextLines(makeJob());
    expect(lines.join("\n")).toContain("URL: https://example.com/path");
    expect(lines.join("\n")).toContain("Reasons:");
    expect(lines.join("\n")).toContain("Redirect chain:");
    expect(lines.join("\n")).toContain("Shortener expansion");

    const attachment = __testables.createIocAttachment(makeJob());
    expect(attachment?.type).toBe("ioc");
    expect(attachment?.media.mimetype).toBe("text/plain");
  });

  it("collects verdict media with screenshot and IOC attachments", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Buffer.from("image-bytes"),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    config.features.attachMediaToVerdicts = true;
    const attachments = await __testables.collectVerdictMedia(makeJob());
    expect(attachments).toHaveLength(2);
    expect(attachments.some((item) => item.type === "screenshot")).toBe(true);
    expect(attachments.some((item) => item.type === "ioc")).toBe(true);
  });

  it("returns no attachments when media is disabled", async () => {
    config.features.attachMediaToVerdicts = false;
    const attachments = await __testables.collectVerdictMedia(makeJob());
    expect(attachments).toHaveLength(0);
  });

  it("delivers verdict messages and schedules ack tracking", async () => {
    config.features.attachMediaToVerdicts = false;
    const chat = {
      id: { _serialized: "chat-1" },
      isGroup: true,
      sendMessage: jest.fn(async () => ({
        id: { _serialized: "v-1" },
        ack: 0,
      })),
    };
    const client = {
      getMessageById: jest.fn(async () => null),
      getChatById: jest.fn(async () => chat),
    } as unknown as Client;

    const context = { chatId: "chat-1", messageId: "msg-1", urlHash: "hash-1" };
    const ok = await __testables.deliverVerdictMessage(
      client,
      makeJob(),
      context,
    );
    expect(ok).toBe(true);
    expect(chat.sendMessage).toHaveBeenCalled();

    await __testables.clearAckWatchForContext(context);
  });

  it("short-circuits verdict delivery when session is not ready", async () => {
    __testables.setSessionSnapshotForTests("disconnected", null);
    const ok = await __testables.deliverVerdictMessage(
      {} as Client,
      makeJob(),
      { chatId: "chat-1", messageId: "msg-1", urlHash: "hash-1" },
    );
    expect(ok).toBe(false);
  });

  it("formats verdict summary text", () => {
    const formatted = formatGroupVerdict(
      "malicious",
      ["reason-1", "reason-2"],
      "https://example.com/path",
    );
    expect(formatted).toContain("Link scan: MALICIOUS");
    expect(formatted).toContain("example[.]com");
    expect(formatted).toContain("Do NOT open.");
  });
});
