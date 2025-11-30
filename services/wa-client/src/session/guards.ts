export interface SessionSnapshot {
  state: string | null;
  wid: string | null;
  paused?: boolean;
}

export function isSessionReady(snapshot: SessionSnapshot): boolean {
  if (snapshot.paused) return false;
  return (
    snapshot.state === "ready" &&
    typeof snapshot.wid === "string" &&
    snapshot.wid.length > 0
  );
}

export function describeSession(snapshot: SessionSnapshot): string {
  const { state, wid, paused } = snapshot;
  const stateLabel = state ?? "unknown";
  const widLabel = wid ?? "unset";
  const pausedLabel = paused ? "paused" : "active";
  return `state=${stateLabel}, wid=${widLabel}, status=${pausedLabel}`;
}
