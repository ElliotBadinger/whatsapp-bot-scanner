import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { GroupChat, Message, GroupParticipant } from "whatsapp-web.js";
import { handleAdminCommand, __testables } from "../index";
import { config } from "@wbscanner/shared";

type MockChat = GroupChat & {
  sendMessage: jest.Mock;
  setMessagesAdminsOnly: jest.Mock;
  participants?: GroupParticipant[];
};

const makeParticipant = (
  id: string,
  isAdmin = false,
  isSuperAdmin = false,
) => ({
  id: { _serialized: id },
  isAdmin,
  isSuperAdmin,
});

const makeChat = (participants: GroupParticipant[]): MockChat =>
  ({
    isGroup: true,
    id: { _serialized: "group-1" },
    participants,
    sendMessage: jest.fn(async () => undefined),
    setMessagesAdminsOnly: jest.fn(async () => undefined),
  }) as unknown as MockChat;

const makeMessage = (
  body: string,
  chat: MockChat,
  author = "admin-1",
): Message =>
  ({
    body,
    from: author,
    author,
    fromMe: false,
    getChat: jest.fn(async () => chat),
    getContact: jest.fn(async () => ({ id: { _serialized: author } })),
  }) as unknown as Message;

describe("wa-client admin commands", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    config.wa.consentOnJoin = true;
    __testables.setPairingContextForTests({ pairingOrchestrator: null });
    __testables.setSessionSnapshotForTests("ready", "bot@c.us");
  });

  it("ignores commands from non-admin senders", async () => {
    const chat = makeChat([makeParticipant("user-1")]);
    const msg = makeMessage("!scanner mute", chat, "user-1");

    await handleAdminCommand({} as any, msg, chat, __testables.redis as any);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("handles mute/unmute/status/rescan commands", async () => {
    const chat = makeChat([makeParticipant("admin-1", true)]);
    const msg = makeMessage("!scanner mute", chat);

    fetchMock
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ scans: 5, malicious: 1 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, urlHash: "hash1", jobId: "job-1" }),
      });

    await handleAdminCommand({} as any, msg, chat, __testables.redis as any);
    await handleAdminCommand(
      {} as any,
      makeMessage("!scanner unmute", chat),
      chat,
      __testables.redis as any,
    );
    await handleAdminCommand(
      {} as any,
      makeMessage("!scanner status", chat),
      chat,
      __testables.redis as any,
    );
    await handleAdminCommand(
      {} as any,
      makeMessage("!scanner rescan https://example.com", chat),
      chat,
      __testables.redis as any,
    );

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(chat.sendMessage).toHaveBeenCalled();
  });

  it("handles consent flows and governance listing", async () => {
    const chat = makeChat([makeParticipant("admin-1", true)]);
    const client = {} as any;

    await __testables.clearConsentState("group-1");

    await handleAdminCommand(
      client,
      makeMessage("!scanner consent", chat),
      chat,
      __testables.redis as any,
    );
    await handleAdminCommand(
      client,
      makeMessage("!scanner consentstatus", chat),
      chat,
      __testables.redis as any,
    );

    __testables.groupStore.listRecentEvents = jest.fn(async () => [
      {
        chatId: "group-1",
        type: "membership_override",
        timestamp: Date.now(),
        actorId: "admin-1",
        recipients: ["user-2"],
      },
    ]);

    await handleAdminCommand(
      client,
      makeMessage("!scanner governance 5", chat),
      chat,
      __testables.redis as any,
    );

    expect(chat.setMessagesAdminsOnly).toHaveBeenCalled();
    expect(chat.sendMessage).toHaveBeenCalled();
  });

  it("handles approve, pair, pair-status, and pair-reset commands", async () => {
    const chat = makeChat([makeParticipant("admin-1", true)]);
    const client = {
      approveGroupMembershipRequests: jest.fn(async () => undefined),
    } as any;

    await __testables.addPendingMembership("group-1", "user-2", Date.now());
    await handleAdminCommand(
      client,
      makeMessage("!scanner approve", chat),
      chat,
      __testables.redis as any,
    );

    await handleAdminCommand(
      client,
      makeMessage("!scanner approve user-2", chat),
      chat,
      __testables.redis as any,
    );

    const pairingOrchestrator = {
      getStatus: () => ({
        rateLimited: false,
        nextAttemptIn: 0,
        canRequest: true,
        consecutiveRateLimits: 0,
        lastAttemptAt: null,
      }),
      requestManually: () => true,
    };

    __testables.setPairingContextForTests({
      pairingOrchestrator: pairingOrchestrator as any,
      remotePhone: "15551234567",
    });

    await handleAdminCommand(
      client,
      makeMessage("!scanner pair", chat),
      chat,
      __testables.redis as any,
    );
    await handleAdminCommand(
      client,
      makeMessage("!scanner pair-status", chat),
      chat,
      __testables.redis as any,
    );
    await handleAdminCommand(
      client,
      makeMessage("!scanner pair-reset", chat),
      chat,
      __testables.redis as any,
    );

    expect(client.approveGroupMembershipRequests).toHaveBeenCalled();
    expect(chat.sendMessage).toHaveBeenCalled();
  });

  it("responds with command list for unknown commands", async () => {
    const chat = makeChat([makeParticipant("admin-1", true)]);
    const msg = makeMessage("!scanner unknown", chat);

    await handleAdminCommand({} as any, msg, chat, __testables.redis as any);

    expect(chat.sendMessage).toHaveBeenCalledWith(
      expect.stringContaining("Commands: !scanner mute"),
    );
  });
});
