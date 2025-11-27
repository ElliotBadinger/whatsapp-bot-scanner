let clientReady = false;
let currentWaState: string | null = null;
let botWid: string | null = null;

export class SessionNotReadyError extends Error {
  public readonly state: string | null;

  constructor(action: string, state: string | null) {
    super(
      `WhatsApp session not ready while attempting to ${action}. Current state: ${state ?? "unknown"}.`,
    );
    this.name = "SessionNotReadyError";
    this.state = state;
  }
}

export function markClientReady(): void {
  clientReady = true;
}

export function markClientDisconnected(): void {
  clientReady = false;
}

export function isClientReady(): boolean {
  return clientReady;
}

export function assertSessionReady(action: string): void {
  if (!clientReady) {
    throw new SessionNotReadyError(action, currentWaState);
  }
}

export function setCurrentSessionState(state: string | null): void {
  currentWaState = state;
}

export function getCurrentSessionState(): string | null {
  return currentWaState;
}

export function setBotWid(wid: string | null): void {
  botWid = wid;
}

export function getBotWid(): string | null {
  return botWid;
}

export function resetRuntimeSessionState(): void {
  clientReady = false;
  currentWaState = null;
  botWid = null;
}
