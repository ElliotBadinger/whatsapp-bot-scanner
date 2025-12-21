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

function getBrowserCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const cookies = document.cookie ? document.cookie.split(";") : [];
  for (const cookie of cookies) {
    const [rawKey, ...rawValueParts] = cookie.trim().split("=");
    if (!rawKey) continue;
    if (rawKey !== name) continue;
    return rawValueParts.join("=");
  }
  return null;
}

async function fetchJsonInternal<T>(
  path: string,
  init: RequestInit,
  options: { allowNoContent: false },
): Promise<T>;
async function fetchJsonInternal<T>(
  path: string,
  init: RequestInit,
  options: { allowNoContent: true },
): Promise<T | undefined>;
async function fetchJsonInternal<T>(
  path: string,
  init: RequestInit,
  options: { allowNoContent: boolean },
): Promise<T | undefined> {
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");

  const method = (init.method || "GET").toUpperCase();
  const isStateChanging = !["GET", "HEAD", "OPTIONS"].includes(method);
  if (isStateChanging) {
    const csrf = getBrowserCookie("safemode_admin_csrf");
    if (csrf && !headers.has("x-csrf-token")) {
      headers.set("x-csrf-token", csrf);
    }
  }

  const resp = await fetch(path, {
    ...init,
    headers,
    cache: "no-store",
  });

  const contentType = resp.headers.get("content-type") ?? "";
  const isJson =
    contentType.includes("application/json") || contentType.includes("+json");

  if (resp.ok && (resp.status === 204 || resp.status === 205)) {
    if (options.allowNoContent) {
      return undefined;
    }

    throw new ApiError("Unexpected empty response.", {
      status: resp.status,
    });
  }

  if (resp.ok) {
    if (!isJson) {
      const preview = await resp.text().catch(() => "");
      const snippet = preview.trim().slice(0, 120);
      const hasSnippet = snippet && !snippet.includes("<");
      const details = hasSnippet ? ` body=${JSON.stringify(snippet)}` : "";
      throw new ApiError(
        `Unexpected response format (content-type=${contentType || "<missing>"})${details}.`,
        { status: resp.status },
      );
    }
    try {
      return (await resp.json()) as T;
    } catch {
      throw new ApiError("Unexpected response format.", {
        status: resp.status,
      });
    }
  }

  let code: string | undefined;
  if (isJson) {
    const parsed = (await resp.json().catch(() => null)) as {
      error?: string;
    } | null;
    code =
      parsed && typeof parsed.error === "string" ? parsed.error : undefined;
  } else {
    const text = await resp.text().catch(() => "");
    const trimmed = text.trim();
    if (
      trimmed.includes("_") &&
      trimmed.length <= 120 &&
      /^[a-z0-9_]+$/.test(trimmed)
    ) {
      code = trimmed;
    }
  }

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

async function fetchJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  return fetchJsonInternal<T>(path, init, {
    allowNoContent: false,
  });
}

async function fetchJsonAllowNoContent<T = void>(
  path: string,
  init: RequestInit = {},
): Promise<T | undefined> {
  return fetchJsonInternal<T>(path, init, { allowNoContent: true });
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
  await fetchJsonAllowNoContent("/api/overrides", {
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

export async function loginAdmin(password: string): Promise<{ expiresAt: string }> {
  return fetchJson<{ expiresAt: string }>("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password }),
  });
}

export async function logoutAdmin(): Promise<void> {
  await fetchJsonAllowNoContent("/api/auth/logout", { method: "POST" });
}

export async function getAdminSession(): Promise<
  | { authenticated: false }
  | { authenticated: true; expiresAt: string }
> {
  return fetchJson<
    | { authenticated: false }
    | { authenticated: true; expiresAt: string }
  >("/api/auth/session");
}
