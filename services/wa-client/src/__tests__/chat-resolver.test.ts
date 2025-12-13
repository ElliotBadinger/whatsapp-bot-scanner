import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { resolveChatForVerdict, ChatLookupError } from "../utils/chatResolver";
import {
  markClientReady,
  markClientDisconnected,
  resetRuntimeSessionState,
  SessionNotReadyError,
} from "../state/runtimeSession";

describe("resolveChatForVerdict", () => {
  const logger = { warn: jest.fn() } as any;

  beforeEach(() => {
    resetRuntimeSessionState();
    jest.clearAllMocks();
  });

  it("throws a descriptive error when chat lookup fails", async () => {
    markClientReady();
    const client = {
      getMessageById: jest.fn(async () => null),
      getChatById: jest.fn(async () => {
        throw new Error("Evaluation failed: b");
      }),
    } as any;

    await expect(
      resolveChatForVerdict({
        client,
        logger,
        chatId: "123@group",
        messageId: "msg-1",
      }),
    ).rejects.toThrow(ChatLookupError);

    expect(client.getChatById).toHaveBeenCalledWith("123@group");
  });

  it("skips chat lookup when session is not ready", async () => {
    markClientDisconnected();
    const client = {
      getMessageById: jest.fn(),
      getChatById: jest.fn(),
    } as any;

    await expect(
      resolveChatForVerdict({
        client,
        logger,
        chatId: "123@group",
        messageId: "msg-1",
      }),
    ).rejects.toThrow(SessionNotReadyError);

    expect(client.getChatById).not.toHaveBeenCalled();
    expect(client.getMessageById).not.toHaveBeenCalled();
  });
});
