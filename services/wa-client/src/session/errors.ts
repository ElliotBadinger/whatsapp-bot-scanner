import type { SessionSnapshot } from "./guards.js";

export interface ChatLookupErrorContext {
  operation: string;
  chatId?: string;
  messageId?: string;
  snapshot: SessionSnapshot;
}

export function enrichEvaluationError(
  err: unknown,
  context: ChatLookupErrorContext,
): Error {
  if (err instanceof Error) {
    if (/Evaluation failed/.test(err.message)) {
      const descriptor = [
        "WhatsApp Web evaluation failed during",
        context.operation,
        context.chatId ? `for chat ${context.chatId}` : "",
        context.messageId ? `message ${context.messageId}` : "",
      ]
        .filter(Boolean)
        .join(" ");
      return new Error(
        `${descriptor.trim()} (session ${context.snapshot.state ?? "unknown"}, wid ${context.snapshot.wid ?? "unset"}). Original message: ${err.message}`,
      );
    }
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
      return new Error(
        `Filesystem artifact missing during ${context.operation}: ${(err as NodeJS.ErrnoException).path ?? "unknown path"} (session ${context.snapshot.state ?? "unknown"}, wid ${context.snapshot.wid ?? "unset"})`,
      );
    }
    return err;
  }
  return new Error(
    `Unexpected error during ${context.operation}: ${String(err)}`,
  );
}
