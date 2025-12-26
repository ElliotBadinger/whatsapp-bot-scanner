import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import type { Logger } from "pino";
import type Redis from "ioredis";

const handlers = new Map<string, (...args: any[]) => Promise<void> | void>();
const mockSocket = {
  ev: {
    on: jest.fn((event: string, handler: (...args: any[]) => void) => {
      handlers.set(event, handler);
    }),
  },
  sendMessage: jest.fn(async () => ({ key: { id: "msg-1" } })),
  end: jest.fn(),
  groupMetadata: jest.fn(async () => ({
    id: "group-1",
    subject: "Group",
    desc: "desc",
    owner: "owner",
    participants: [
      { id: "p1", admin: "admin" },
      { id: "p2", admin: "superadmin" },
    ],
    creation: 1700000000,
  })),
  onWhatsApp: jest.fn(async () => [{ exists: true }]),
  requestPairingCode: jest.fn(async (num: string) => `code-${num}`),
  profilePictureUrl: jest.fn(async () => "https://pic"),
  sendPresenceUpdate: jest.fn(async () => undefined),
  readMessages: jest.fn(async () => undefined),
  updateBlockStatus: jest.fn(async () => undefined),
  groupParticipantsUpdate: jest.fn(async () => undefined),
  groupUpdateSubject: jest.fn(async () => undefined),
  groupUpdateDescription: jest.fn(async () => undefined),
  groupLeave: jest.fn(async () => undefined),
  groupInviteCode: jest.fn(async () => "invite-code"),
  groupAcceptInvite: jest.fn(async () => "group-2"),
  fetchBlocklist: jest.fn(async () => ["block-1", undefined]),
  groupCreate: jest.fn(async () => ({
    id: "group-3",
    subject: "New",
    desc: null,
    owner: "owner",
    participants: [{ id: "p3", admin: "admin" }],
    creation: 1700000001,
  })),
  updateMediaMessage: jest.fn(),
  user: { id: "bot@c.us" },
};

const mockMakeWASocket = jest.fn().mockReturnValue(mockSocket);
const mockMakeCacheableSignalKeyStore = jest.fn().mockReturnValue({});
const mockFetchLatestBaileysVersion = jest
  .fn<() => Promise<{ version: number[]; isLatest: boolean }>>()
  .mockResolvedValue({
    version: [2, 3000, 123],
    isLatest: true,
  });
const mockUseMultiFileAuthState = jest.fn().mockResolvedValue({
  state: {
    creds: { me: null },
    keys: {},
  },
  saveCreds: jest.fn(),
});
const mockGenerateForwardMessageContent = jest
  .fn()
  .mockReturnValue({ text: "forward" });
const mockDownloadMediaMessage = jest
  .fn()
  .mockResolvedValue(Buffer.from("media"));

jest.unstable_mockModule("@whiskeysockets/baileys", () => ({
  __esModule: true,
  default: mockMakeWASocket,
  makeWASocket: mockMakeWASocket,
  makeCacheableSignalKeyStore: mockMakeCacheableSignalKeyStore,
  fetchLatestBaileysVersion: mockFetchLatestBaileysVersion,
  useMultiFileAuthState: mockUseMultiFileAuthState,
  generateForwardMessageContent: mockGenerateForwardMessageContent,
  downloadMediaMessage: mockDownloadMediaMessage,
  DisconnectReason: {
    loggedOut: 401,
  },
  isJidGroup: jest.fn((jid: string) => jid?.includes("@g.us")),
  jidNormalizedUser: jest.fn((jid: string) => jid),
}));

jest.unstable_mockModule("../../src/auth/baileys-auth-store", () => ({
  useRedisAuthState: jest.fn<() => Promise<unknown>>().mockResolvedValue({
    state: {
      creds: { me: null },
      keys: {},
    },
    saveCreds: jest.fn(),
    clearState: jest.fn(),
  }),
  sessionExists: jest.fn(async () => false),
}));

describe("BaileysAdapter coverage", () => {
  let adapter: import("../../src/adapters/baileys-adapter").BaileysAdapter;
  let BaileysAdapter: typeof import("../../src/adapters/baileys-adapter").BaileysAdapter;
  let mockRedis: Redis;
  let mockLogger: Logger;

  beforeEach(async () => {
    handlers.clear();
    jest.clearAllMocks();
    ({ BaileysAdapter } = await import("../../src/adapters/baileys-adapter"));
    mockRedis = {} as Redis;
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
      authStore: "redis",
    });
  });

  afterEach(async () => {
    await adapter.disconnect();
  });

  it("connects and handles connection updates", async () => {
    await adapter.connect();
    const handler = handlers.get("connection.update");
    expect(handler).toBeTruthy();
    await handler?.({ connection: "open" });
    expect(adapter.state).toBe("ready");
    expect(adapter.botId).toBe("bot@c.us");
  });

  it("converts and forwards message events", async () => {
    const onMessage = jest.fn();
    adapter.onMessage(onMessage);
    await adapter.connect();

    const handler = handlers.get("messages.upsert");
    await handler?.({
      type: "notify",
      messages: [
        {
          key: {
            remoteJid: "chat@g.us",
            id: "msg-1",
            participant: "user@c.us",
          },
          message: { conversation: "hi" },
          messageTimestamp: 1,
        },
      ],
    });

    expect(onMessage).toHaveBeenCalled();
  });

  it("sends supported message types", async () => {
    await adapter.connect();

    await adapter.sendMessage("chat@c.us", { type: "text", text: "hi" });
    await adapter.sendMessage("chat@c.us", {
      type: "image",
      data: "aGVsbG8=",
      caption: "cap",
      mimetype: "image/png",
    });
    await adapter.sendMessage("chat@c.us", {
      type: "video",
      data: Buffer.from("video"),
    });
    await adapter.sendMessage("chat@c.us", {
      type: "audio",
      data: Buffer.from("audio"),
    });
    await adapter.sendMessage("chat@c.us", {
      type: "document",
      data: Buffer.from("doc"),
      filename: "file.txt",
    });
    const reaction = await adapter.sendMessage("chat@c.us", {
      type: "reaction",
      emoji: "✅",
      messageId: "msg-1",
    });
    expect(reaction.success).toBe(true);

    await adapter.sendMessage("chat@c.us", {
      type: "sticker",
      data: Buffer.from("sticker"),
    });
    await adapter.sendMessage("chat@c.us", {
      type: "location",
      latitude: 1,
      longitude: 2,
      name: "name",
      address: "addr",
    });
    await adapter.sendMessage("chat@c.us", {
      type: "contact",
      displayName: "contact",
      vcard: "vcard",
    });

    expect(mockSocket.sendMessage).toHaveBeenCalled();
  });

  it("replies and reacts to messages", async () => {
    await adapter.connect();
    const msg = {
      id: "msg-1",
      chatId: "chat@c.us",
      fromMe: false,
      raw: {},
    } as any;
    await adapter.reply(msg, { type: "text", text: "reply" });
    await adapter.react(msg, "👍");
    await adapter.deleteMessage(msg, true);
    expect(mockSocket.sendMessage).toHaveBeenCalled();
  });

  it("handles group metadata and membership actions", async () => {
    await adapter.connect();
    const metadata = await adapter.getGroupMetadata("group-1");
    expect(metadata?.participants.length).toBe(2);

    await adapter.addParticipants("group-1", ["u1"]);
    await adapter.removeParticipants("group-1", ["u1"]);
    await adapter.promoteParticipants("group-1", ["u1"]);
    await adapter.demoteParticipants("group-1", ["u1"]);
    await adapter.setGroupSubject("group-1", "new");
    await adapter.setGroupDescription("group-1", "desc");
    await adapter.leaveGroup("group-1");
  });

  it("handles utility operations", async () => {
    await adapter.connect();
    expect(await adapter.isOnWhatsApp("123")).toBe(true);

    const pairing = await adapter.requestPairingCode("+1 (555) 123-4567");
    expect(pairing).toContain("code-15551234567");

    await adapter.sendPresenceUpdate("composing", "chat@c.us");
    await adapter.sendSeen("chat@c.us", ["m1"]);

    await adapter.getProfilePicUrl("chat@c.us");
    await adapter.blockContact("chat@c.us");
    await adapter.unblockContact("chat@c.us");
    const blocklist = await adapter.getBlockedContacts();
    expect(blocklist).toEqual(["block-1"]);
  });

  it("supports forwarding and media download", async () => {
    await adapter.connect();
    const msg = {
      id: "msg-1",
      chatId: "chat@c.us",
      fromMe: false,
      raw: { key: { id: "1" }, message: { conversation: "hi" } },
    } as any;
    const forwardResult = await adapter.forwardMessage("chat@c.us", msg);
    expect(forwardResult.success).toBe(true);

    const media = await adapter.downloadMedia(msg);
    expect(media.toString()).toBe("media");
  });

  it("handles group creation and invites", async () => {
    await adapter.connect();
    const group = await adapter.createGroup("Test", ["u1"]);
    expect(group.id).toBe("group-3");

    const invite = await adapter.getInviteCode("group-1");
    expect(invite).toBe("invite-code");

    const joined = await adapter.acceptInvite("code");
    expect(joined).toBe("group-2");
  });
});
