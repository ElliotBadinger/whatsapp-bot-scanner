import { describe, expect, it, jest } from "@jest/globals";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { resetRemoteSessionArtifacts } from "../../src/session/cleanup";
import { safeGetGroupChatById } from "../../src/utils/chatLookup";
import { handleSelfMessageRevoke } from "../../src/handlers/selfRevoke";
import type { SessionSnapshot } from "../../src/session/guards";

class FakeRemoteStore {
  private store = new Map<string, string>();

  constructor(sessionName: string) {
    this.store.set(sessionName, "mock-payload");
  }

  async delete({ session }: { session: string }): Promise<void> {
    this.store.delete(session);
  }

  has(session: string): boolean {
    return this.store.has(session);
  }
}

async function prepareSessionArtifacts(sessionName: string) {
  const baseDir = await fs.mkdtemp(path.join(tmpdir(), "wa-functional-"));
  const dataPath = path.join(baseDir, "remote-session");
  await fs.mkdir(
    path.join(dataPath, "wwebjs_temp_session_default", "Default"),
    { recursive: true },
  );
  await fs.writeFile(
    path.resolve(`${sessionName}.zip`),
    Buffer.from("functional-session"),
  );
  return { baseDir, dataPath };
}

async function cleanupSessionArtifacts(sessionName: string, baseDir: string) {
  await fs
    .rm(path.resolve(`${sessionName}.zip`), { force: true })
    .catch(() => {});
  await fs.rm(baseDir, { recursive: true, force: true }).catch(() => {});
}

function createGroupClient(group: any = { isGroup: true }) {
  return {
    getChatById: jest.fn(async () => group) as jest.MockedFunction<
      (chatId: string) => Promise<any>
    >,
  };
}

function createGetChatMock(chatId: string) {
  return jest.fn(async () => ({
    id: { _serialized: chatId },
  })) as jest.MockedFunction<() => Promise<any>>;
}

function createTwoArgLogger() {
  return {
    debug: jest.fn() as jest.MockedFunction<
      (context: unknown, message: string) => void
    >,
    warn: jest.fn() as jest.MockedFunction<
      (context: unknown, message: string) => void
    >,
  };
}

function createMockMessageStore() {
  const store = new Map<
    string,
    { revocations: Array<{ scope: "me" | "everyone"; timestamp: number }> }
  >();
  return {
    async ensureRecord(details: {
      chatId: string;
      messageId: string;
      senderId?: string;
    }) {
      const key = `${details.chatId}:${details.messageId}`;
      if (!store.has(key)) {
        store.set(key, { revocations: [] });
      }
      return store.get(key);
    },
    async recordRevocation(
      chatId: string,
      messageId: string,
      scope: "me" | "everyone",
      timestamp: number,
    ) {
      const key = `${chatId}:${messageId}`;
      const entry = store.get(key);
      if (!entry) {
        store.set(key, { revocations: [{ scope, timestamp }] });
        return;
      }
      entry.revocations.push({ scope, timestamp });
    },
    async getRecord(chatId: string, messageId: string) {
      const entry = store.get(`${chatId}:${messageId}`);
      if (!entry) return null;
      return { revocations: [...entry.revocations] };
    },
  };
}

describe("wa-client functional flows", () => {
  it("force-new-session cleanup enables fresh chat operations", async () => {
    const sessionName = "RemoteAuth-functional-session";
    const { baseDir, dataPath } = await prepareSessionArtifacts(sessionName);
    const store = new FakeRemoteStore(sessionName);
    const logger = { warn: jest.fn(), info: jest.fn(), debug: jest.fn() };

    const messageStore = createMockMessageStore();
    try {
      await resetRemoteSessionArtifacts({
        store,
        sessionName,
        dataPath,
        logger: logger as any,
      });

      expect(store.has(sessionName)).toBe(false);
      const reconstructedDir = path.join(
        dataPath,
        "wwebjs_temp_session_default",
        "Default",
      );
      const stats = await fs.stat(reconstructedDir);
      expect(stats.isDirectory()).toBe(true);

      await messageStore.ensureRecord({
        chatId: "123@c.us",
        messageId: "msg-001",
        senderId: "bot@c.us",
      });

      const snapshot: SessionSnapshot = { state: "ready", wid: "bot@c.us" };
      const client = createGroupClient();
      const loggerAdapter = createTwoArgLogger();

      const chat = await safeGetGroupChatById({
        client: client as any,
        chatId: "123@c.us",
        snapshot,
        logger: loggerAdapter as any,
      });
      expect(chat).not.toBeNull();

      await handleSelfMessageRevoke(
        {
          id: { _serialized: "msg-001", id: "msg-001" },
          getChat: createGetChatMock("123@c.us"),
        } as any,
        {
          snapshot,
          logger: loggerAdapter as any,
          messageStore: messageStore as any,
          recordMetric: jest.fn(),
          now: () => 456,
        },
      );

      const record = await messageStore.getRecord("123@c.us", "msg-001");
      expect(record?.revocations.at(-1)).toMatchObject({
        scope: "me",
        timestamp: 456,
      });
    } finally {
      await cleanupSessionArtifacts(sessionName, baseDir);
    }
  });

  it("records message revoke without crashing", async () => {
    const messageStore = createMockMessageStore();
    await messageStore.ensureRecord({
      chatId: "456@c.us",
      messageId: "msg-002",
      senderId: "bot@c.us",
    });

    const snapshot: SessionSnapshot = { state: "ready", wid: "bot@c.us" };
    const logger = {
      debug: jest.fn() as jest.MockedFunction<
        (context: unknown, message: string) => void
      >,
    };
    const recordMetric = jest.fn();
    await expect(
      handleSelfMessageRevoke(
        {
          id: { _serialized: "msg-002", id: "msg-002" },
          getChat: createGetChatMock("456@c.us"),
        } as any,
        {
          snapshot,
          logger: logger as any,
          messageStore: messageStore as any,
          recordMetric,
          now: () => 789,
        },
      ),
    ).resolves.toBe("recorded");

    const record = await messageStore.getRecord("456@c.us", "msg-002");
    expect(record?.revocations.at(-1)).toMatchObject({
      scope: "me",
      timestamp: 789,
    });
    expect(recordMetric).toHaveBeenCalled();
  });

  it("survives force-new-session followed by message revoke sequence", async () => {
    const sessionName = "RemoteAuth-functional-combined";
    const { baseDir, dataPath } = await prepareSessionArtifacts(sessionName);
    const store = new FakeRemoteStore(sessionName);
    const logger = { warn: jest.fn(), info: jest.fn(), debug: jest.fn() };
    const messageStore = createMockMessageStore();
    try {
      await resetRemoteSessionArtifacts({
        store,
        sessionName,
        dataPath,
        logger: logger as any,
      });

      await messageStore.ensureRecord({
        chatId: "789@c.us",
        messageId: "msg-003",
        senderId: "bot@c.us",
      });

      const snapshot: SessionSnapshot = { state: "ready", wid: "bot@c.us" };
      const client = createGroupClient();
      const chatLookupLogger = createTwoArgLogger();
      await expect(
        safeGetGroupChatById({
          client: client as any,
          chatId: "789@c.us",
          snapshot,
          logger: chatLookupLogger as any,
        }),
      ).resolves.not.toBeNull();

      await handleSelfMessageRevoke(
        {
          id: { _serialized: "msg-003", id: "msg-003" },
          getChat: createGetChatMock("789@c.us"),
        } as any,
        {
          snapshot,
          logger: chatLookupLogger as any,
          messageStore: messageStore as any,
          recordMetric: jest.fn(),
          now: () => 111,
        },
      );

      const record = await messageStore.getRecord("789@c.us", "msg-003");
      expect(record?.revocations.at(-1)).toMatchObject({
        scope: "me",
        timestamp: 111,
      });
    } finally {
      await cleanupSessionArtifacts(sessionName, baseDir);
    }
  });
});
jest.setTimeout(20000);
