export interface SystemStatus {
  scans: number;
  malicious: number;
  groups: number;
}

export type ScanVerdictLevel = "SAFE" | "WARN" | "DENY";

export interface ScanVerdict {
  id: string;
  timestamp: string;
  url: string;
  urlHash?: string;
  verdict: ScanVerdictLevel;
}

export interface RescanResult {
  ok: boolean;
  urlHash: string;
  jobId: string | number;
}

export interface Override {
  id: string;
  pattern: string;
  action: "allow" | "block";
  reason: string;
  createdAt: string;
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly code?: string;

  constructor(message: string, options: { status: number; code?: string }) {
    super(message);
    this.name = "ApiError";
    this.status = options.status;
    this.code = options.code;
  }
}

async function fetchJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");

  const resp = await fetch(path, {
    ...init,
    headers,
    cache: "no-store",
  });

  const contentType = resp.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");

  if (resp.ok) {
    if (!isJson) {
      throw new ApiError("Unexpected response format.", {
        status: resp.status,
      });
    }
    return resp.json() as Promise<T>;
  }

  const body = isJson
    ? ((await resp.json().catch(() => ({}))) as { error?: string })
    : {};
  const code =
    isJson && typeof body.error === "string" ? body.error : undefined;

  const message =
    resp.status === 400
      ? "Request was invalid."
      : resp.status === 401
        ? "Authentication failed."
        : resp.status === 404
          ? "Resource not found."
          : resp.status >= 500
            ? "Control-plane is temporarily unavailable."
            : "Request failed.";

  throw new ApiError(message, { status: resp.status, code });
}

export async function getStatus(): Promise<SystemStatus> {
  return fetchJson<SystemStatus>("/api/status");
}

function normalizeLimit(limit: unknown, fallback = 10): number {
  const parsed = Number.parseInt(String(limit), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, 100);
}

export async function getRecentScans(limit = 10): Promise<ScanVerdict[]> {
  const normalizedLimit = normalizeLimit(limit, 10);
  const limitParam = encodeURIComponent(String(normalizedLimit));
  return fetchJson<ScanVerdict[]>(`/api/scans/recent?limit=${limitParam}`);
}

export async function rescanUrl(url: string): Promise<RescanResult> {
  return fetchJson<RescanResult>("/api/rescan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url }),
  });
}

export async function getOverrides(): Promise<Override[]> {
  return fetchJson<Override[]>("/api/overrides");
}

export async function addOverride(
  pattern: string,
  action: "allow" | "block",
  reason: string,
): Promise<void> {
  await fetchJson("/api/overrides", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pattern, action, reason }),
  });
}

export async function muteGroup(
  chatId: string,
): Promise<{ ok: boolean; muted_until: string }> {
  return fetchJson<{ ok: boolean; muted_until: string }>(
    `/api/groups/${encodeURIComponent(chatId)}/mute`,
    { method: "POST" },
  );
}

export async function unmuteGroup(chatId: string): Promise<{ ok: boolean }> {
  return fetchJson<{ ok: boolean }>(
    `/api/groups/${encodeURIComponent(chatId)}/unmute`,
    { method: "POST" },
  );
}
