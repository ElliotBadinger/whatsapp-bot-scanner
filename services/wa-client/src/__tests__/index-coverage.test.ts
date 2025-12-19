import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import type { GroupChat, Message } from "whatsapp-web.js";

jest.mock("fastify", () => {
  const appInstances: any[] = [];
  const createApp = () => {
    const routes = new Map<string, any>();
    const app = {
      routes,
      get: jest.fn((path: string, handler: any) => {
        routes.set(`GET ${path}`, handler);
      }),
      post: jest.fn((path: string, handler: any) => {
        routes.set(`POST ${path}`, handler);
      }),
      listen: jest.fn(async () => undefined),
      close: jest.fn(async () => undefined),
    };
    appInstances.push(app);
    return app;
  };
  (createApp as any).appInstances = appInstances;
  return createApp;
});

jest.mock("qrcode-terminal", () => ({
  __esModule: true,
  default: { generate: jest.fn() },
}));

jest.mock("bullmq", () => {
  class Queue {
    static instances: Queue[] = [];
    name: string;
    add: jest.Mock;
    constructor(name: string) {
      this.name = name;
      this.add = jest.fn(async () => ({ id: `job:${name}` }));
      Queue.instances.push(this);
    }
  }
  class Worker {
    static instances: Worker[] = [];
    name: string;
    processor: any;
    constructor(name: string, processor: any) {
      this.name = name;
      this.processor = processor;
      Worker.instances.push(this);
    }
  }
  return { Queue, Worker };
});

jest.mock("rate-limiter-flexible", () => {
  class RateLimiterRedis {
    static instances: RateLimiterRedis[] = [];
    options: any;
    consume: jest.Mock;
    constructor(options: any) {
      this.options = options;
      this.consume = jest.fn(async () => undefined);
      RateLimiterRedis.instances.push(this);
    }
  }
  return { RateLimiterRedis };
});

jest.mock("../pairingOrchestrator", () => {
  class PairingOrchestrator {
    static instances: PairingOrchestrator[] = [];
    options: any;
    enabled: boolean;
    sessionActive: boolean;
    codeDelivered: boolean;
    scheduledDelay: number | null = null;
    canceled = false;
    constructor(options: any) {
      this.options = options;
      this.enabled = options.enabled ?? true;
      this.sessionActive = false;
      this.codeDelivered = false;
      PairingOrchestrator.instances.push(this);
    }
    async init() {
      return;
    }
    cancel() {
      this.canceled = true;
    }
    schedule(delayMs: number) {
      this.scheduledDelay = delayMs;
      return true;
    }
    setEnabled(enabled: boolean) {
      this.enabled = enabled;
    }
    setSessionActive(active: boolean) {
      this.sessionActive = active;
    }
    setCodeDelivered(delivered: boolean) {
      this.codeDelivered = delivered;
    }
    getStatus() {
      return {
        rateLimited: false,
        nextAttemptIn: 0,
        canRequest: !this.sessionActive,
        consecutiveRateLimits: 0,
        lastAttemptAt: null,
      };
    }
    requestManually() {
      return true;
    }
  }
  return { PairingOrchestrator };
});

jest.mock("../session/sessionManager", () => {
  class SessionManager {
    clearSession = jest.fn(async () => undefined);
    constructor(_: any) {}
  }
  return { SessionManager };
});

jest.mock("../session/guards", () => ({
  __esModule: true,
  describeSession: jest.fn(() => "state=ready,wid=mock@c.us,status=active"),
  isSessionReady: jest.fn(() => true),
}));

let shared: typeof import("@wbscanner/shared");
let mod: typeof import("../index");

const resetConfig = () => {
  shared.config.features.attachMediaToVerdicts = true;
  shared.config.wa.authStrategy = "remote";
  shared.config.wa.consentOnJoin = true;
  shared.config.wa.remoteAuth.phoneNumbers = ["15551234567"];
  shared.config.wa.remoteAuth.autoPair = true;
  shared.config.wa.remoteAuth.forceNewSession = false;
  shared.config.wa.remoteAuth.dataKey =
    process.env.WA_REMOTE_AUTH_DATA_KEY || "";
};

describe("wa-client index coverage", () => {
  beforeEach(async () => {
    if (!shared || !mod) {
      shared = await import("@wbscanner/shared");
      mod = await import("../index");
    }
    resetConfig();
    const redis = mod.__testables.redis as { clear?: () => void };
    redis.clear?.();
    (await import("whatsapp-web.js")).Client.clearInstances();
  });

  beforeEach(() => {
    jest.useRealTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it("covers pairing cache helpers and masking utilities", async () => {
    const { __testables } = mod;

    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(1710000000000);
    await __testables.cachePairingCode("15551234567", "ABC-123");
    const cached = await __testables.getCachedPairingCode("15551234567");
    expect(cached).toEqual({ code: "ABC-123", storedAt: 1710000000000 });
    nowSpy.mockRestore();

    expect(__testables.maskPhone("15551234567")).toBe("****4567");
    expect(__testables.maskPhone("1234")).toBe("1234");

    expect(__testables.expandWidVariants("123@c.us")).toEqual([
      "123@c.us",
      "123@lid",
    ]);
    expect(__testables.expandWidVariants("123@lid")).toEqual([
      "123@lid",
      "123@c.us",
    ]);
    expect(__testables.expandWidVariants("123")).toEqual(["123"]);
    expect(__testables.contextKey({ chatId: "c1", messageId: "m1", urlHash: "h1" })).toBe(
      "c1:m1:h1",
    );
  });

  it("resolves auth strategy and handles force reset fallback", async () => {
    resetConfig();
    shared.config.wa.remoteAuth.forceNewSession = true;
    shared.config.wa.remoteAuth.clientId = "test-client";
    shared.config.wa.remoteAuth.store = "redis";

    const { __testables } = mod;
    const redis = __testables.redis as {
      set: (key: string, value: string) => Promise<unknown>;
    };
    await redis.set(
      "remoteauth:v1:test-client:RemoteAuth-test-client",
      "1",
    );

    await __testables.resolveAuthStrategy(redis as any);
    expect(shared.config.wa.remoteAuth.forceNewSession).toBe(false);
  });

  it("validates scanning allowlist and builds IOC attachments", async () => {
    const { __testables } = mod;

    process.env.CONTROL_PLANE_BASE = "https://control-plane.local/";
    expect(__testables.resolveControlPlaneBase()).toBe(
      "https://control-plane.local",
    );
    process.env.CONTROL_PLANE_BASE = "ftp://control-plane.local";
    expect(__testables.resolveControlPlaneBase()).toBe(
      "http://control-plane:8080",
    );
    expect(__testables.sanitizeLogValue("a\nb\tc")).toBe("a b c");

    shared.__setPrivateHostnameResult(true);
    await expect(
      __testables.isUrlAllowedForScanning("http://10.0.0.1"),
    ).resolves.toBe(false);
    shared.__setPrivateHostnameResult(false);

    await expect(
      __testables.isUrlAllowedForScanning("http://example.com:99999"),
    ).resolves.toBe(false);

    const job = {
      chatId: "c1",
      messageId: "m1",
      verdict: "malicious",
      reasons: ["reason-a"],
      url: "https://example.com",
      urlHash: "hash1",
      redirectChain: ["https://redir.example.com"],
      shortener: { provider: "short", chain: ["https://short.ly"] },
    };
    const lines = __testables.buildIocTextLines(job);
    expect(lines.join("\n")).toContain("Reasons:");
    const attachment = __testables.createIocAttachment(job);
    expect(attachment?.media.mimetype).toBe("text/plain");
  });

  it("collects verdict media and sends corrections", async () => {
    const { __testables } = mod;

    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new TextEncoder().encode("image").buffer,
      } as Response);

    __testables.setSessionSnapshotForTests("ready", "bot@c.us");

    const attachments = await __testables.collectVerdictMedia({
      chatId: "c1",
      messageId: "m1",
      verdict: "malicious",
      reasons: ["reason-a"],
      url: "https://example.com",
      urlHash: "hash1",
    });
    expect(attachments).toHaveLength(2);

    const chat = {
      isGroup: true,
      id: { _serialized: "group-1" },
      sendMessage: jest.fn(async () => ({
        id: { _serialized: "reply-1" },
        ack: 2,
      })),
    } as unknown as GroupChat;

    const message = {
      id: { _serialized: "msg-1" },
      getChat: jest.fn(async () => chat),
      reply: jest.fn(async () => ({
        id: { _serialized: "verdict-1" },
        ack: 2,
      })),
      react: jest.fn(async () => undefined),
    } as unknown as Message;

    const previousVerdictId = "verdict-old";
    await __testables.messageStore.registerVerdictAttempt({
      chatId: "c1",
      messageId: "m1",
      url: "https://example.com",
      urlHash: "hash1",
      verdict: "benign",
      reasons: [],
      verdictMessageId: previousVerdictId,
    });

    const client = new (await import("whatsapp-web.js")).Client();
    client.getMessageById = jest.fn(async (id: string) => {
      if (id === previousVerdictId) {
        return { delete: jest.fn(async () => undefined) };
      }
      return message;
    });

    const ok = await __testables.deliverVerdictMessage(
      client,
      {
        chatId: "c1",
        messageId: "m1",
        verdict: "malicious",
        reasons: ["bad"],
        url: "https://example.com",
        urlHash: "hash1",
        degradedMode: { providers: [{ name: "GSB", reason: "down" }] },
        isCorrection: true,
      },
      { chatId: "c1", messageId: "m1", urlHash: "hash1" },
    );

    expect(ok).toBe(true);
    expect(chat.sendMessage).toHaveBeenCalled();
    expect(message.reply).toHaveBeenCalled();
    fetchSpy.mockRestore();
    await __testables.clearAckWatchForContext({
      chatId: "c1",
      messageId: "m1",
      urlHash: "hash1",
    });
  });

  it("retries verdicts when ack timeout fires", async () => {
    shared.config.wa.verdictAckTimeoutSeconds = 5;
    shared.config.wa.verdictMaxRetries = 3;
    const { __testables } = mod;
    jest.useFakeTimers();

    const context = { chatId: "c1", messageId: "m1", urlHash: "hash1" };
    await __testables.messageStore.registerVerdictAttempt({
      chatId: "c1",
      messageId: "m1",
      url: "https://example.com",
      urlHash: "hash1",
      verdict: "suspicious",
      reasons: ["reason"],
    });

    const retry = jest.fn(async () => undefined);
    await __testables.scheduleAckWatch(context, retry);
    await jest.advanceTimersByTimeAsync(6000);

    expect(retry).toHaveBeenCalled();
    await __testables.clearAckWatchForContext(context);
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("runs main and handles key events", async () => {
    const { __testables } = mod;
    jest.useFakeTimers();

    const exitSpy = jest
      .spyOn(process, "exit")
      .mockImplementation(((code?: number) => undefined) as any);

    await __testables.main();
    const { Client } = await import("whatsapp-web.js");
    const client = (Client as any).instances[0];
    expect(client).toBeTruthy();

    const chat = {
      isGroup: true,
      id: { _serialized: "group-1" },
      sendMessage: jest.fn(async () => ({
        id: { _serialized: "msg-2" },
      })),
      setMessagesAdminsOnly: jest.fn(async () => true),
    } as unknown as GroupChat;

    const message = {
      body: "Check https://example.com and http://bad",
      from: "user-1",
      author: "user-1",
      timestamp: 1,
      id: { id: "msg-1", _serialized: "msg-1" },
      getChat: jest.fn(async () => chat),
      getContact: jest.fn(async () => ({ id: { _serialized: "user-1" } })),
      reply: jest.fn(async () => ({
        id: { _serialized: "reply-1" },
        ack: 2,
      })),
    } as unknown as Message;

    shared.__setExtractUrls(() => ["https://example.com", "http://bad"]);
    shared.__setNormalizeUrl((input: string) =>
      input.includes("bad") ? "" : input,
    );

    await __testables.markConsentGranted("group-1");
    await client.emit("message_create", message);

    const verdictContext = {
      chatId: "group-1",
      messageId: "msg-1",
      urlHash: "hash:https://example.com",
    };
    await __testables.messageStore.registerVerdictAttempt({
      chatId: verdictContext.chatId,
      messageId: verdictContext.messageId,
      url: "https://example.com",
      urlHash: verdictContext.urlHash,
      verdict: "malicious",
      reasons: ["reason"],
      verdictMessageId: "ack-1",
    });

    await client.emit("message_edit", {
      body: "Edited https://updated.example.com",
      from: "user-1",
      author: "user-1",
      id: { id: "msg-1", _serialized: "msg-1" },
      getChat: jest.fn(async () => chat),
      reply: jest.fn(async () => ({ id: { _serialized: "reply-2" } })),
    } as unknown as Message);

    const revokedMessage = {
      id: { id: "msg-1", _serialized: "msg-1" },
      getChat: jest.fn(async () => chat),
    } as unknown as Message;
    await client.emit("message_revoke_everyone", revokedMessage, revokedMessage);

    client.getMessageById = jest.fn(async () => ({
      getChat: jest.fn(async () => chat),
    }));
    await client.emit("message_reaction", {
      msgId: { _serialized: "msg-1" },
      reaction: ":)",
      senderId: "user-1",
      timestamp: 1,
    });

    await client.emit(
      "message_ack",
      { id: { _serialized: "ack-1" } },
      2,
    );

    await client.emit("group_join", {
      author: "user-1",
      recipientIds: ["user-2"],
      getChat: jest.fn(async () => chat),
    });

    await client.emit("group_membership_request", {
      author: "user-3",
      recipientIds: ["user-3"],
      timestamp: 2,
      getChat: jest.fn(async () => chat),
    });

    await client.emit("group_leave", {
      author: "user-2",
      recipientIds: ["user-2"],
      type: "remove",
      getChat: jest.fn(async () => chat),
    });

    await client.emit("group_admin_changed", {
      author: "user-1",
      recipientIds: ["user-2"],
      type: "promote",
      body: "promoted",
      getChat: jest.fn(async () => chat),
      getRecipients: jest.fn(async () => [
        { id: { _serialized: "user-2", user: "user-2" } },
      ]),
    });

    await client.emit("group_update", {
      author: "user-1",
      recipientIds: ["user-2"],
      type: "announce",
      body: "announce",
      getChat: jest.fn(async () => chat),
    });

    await client.emit("incoming_call", {
      from: "user-4",
      isGroup: false,
      isVideo: false,
      reject: jest.fn(async () => undefined),
    });

    await client.emit("qr", "qr-123");
    await client.emit("remote_session_saved");
    await client.emit("code", "999-999");
    await client.emit("authenticated");
    await jest.advanceTimersByTimeAsync(6000);
    await client.emit("ready");

    await client.emit("change_state", "CONNECTED");
    await client.emit("loading_screen", 50, "loading");
    await client.emit("disconnected", "bye");
    await client.emit("auth_failure", "fail");

    jest.clearAllTimers();
    shared.__setExtractUrls(() => []);
    shared.__setNormalizeUrl((input: string) => input);
    exitSpy.mockRestore();
    jest.useRealTimers();
  });
});
