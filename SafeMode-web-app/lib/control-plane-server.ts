import "server-only";

export class ControlPlaneError extends Error {
  public readonly status: number;
  public readonly code?: string;

  constructor(message: string, options: { status: number; code?: string }) {
    super(message);
    this.name = "ControlPlaneError";
    this.status = options.status;
    this.code = options.code;
  }
}

function resolveControlPlaneBase(): string {
  const candidate = (
    process.env.CONTROL_PLANE_URL ||
    process.env.CONTROL_PLANE_BASE ||
    "http://localhost:8080"
  ).trim();

  try {
    const parsed = new URL(candidate);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("invalid protocol");
    }
    parsed.hash = "";
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return "http://localhost:8080";
  }
}

function getControlPlaneToken(): string {
  const token = (process.env.CONTROL_PLANE_API_TOKEN || "").trim();
  if (!token) {
    throw new Error("CONTROL_PLANE_API_TOKEN is required");
  }
  return token;
}

export async function controlPlaneFetch(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const base = resolveControlPlaneBase();
  const token = getControlPlaneToken();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;

  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);
  if (!headers.has("accept")) {
    headers.set("accept", "application/json");
  }

  const timeoutMs = init.timeoutMs ?? 8000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      headers,
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function controlPlaneFetchJson<T>(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const resp = await controlPlaneFetch(path, init);
  if (resp.ok) {
    return resp.json() as Promise<T>;
  }

  const body = (await resp.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
  };
  const code = typeof body.error === "string" ? body.error : undefined;
  const message =
    (typeof body.message === "string" ? body.message : undefined) ||
    (typeof body.error === "string" ? body.error : undefined) ||
    "Control-plane request failed";
  throw new ControlPlaneError(message, { status: resp.status, code });
}
