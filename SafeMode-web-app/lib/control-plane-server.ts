import "server-only";

import { getEnv } from "./env";

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
  // Assumes `CONTROL_PLANE_URL` has already been validated by `validateEnv()`.
  // Normalizes the base URL (removes hash and trailing slashes).
  const { CONTROL_PLANE_URL } = getEnv();
  const parsed = new URL(CONTROL_PLANE_URL);

  parsed.hash = "";

  let base = parsed.toString();
  while (base.endsWith("/")) {
    base = base.slice(0, -1);
  }

  return base;
}

export async function controlPlaneFetch(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const base = resolveControlPlaneBase();
  const token = getEnv().CONTROL_PLANE_API_TOKEN;
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

async function controlPlaneFetchJsonInternal<T>(
  path: string,
  init: RequestInit & { timeoutMs?: number },
  options: { allowNoContent: false },
): Promise<{ status: number; data: T }>;
async function controlPlaneFetchJsonInternal<T>(
  path: string,
  init: RequestInit & { timeoutMs?: number },
  options: { allowNoContent: true },
): Promise<{ status: number; data: T | undefined }>;
async function controlPlaneFetchJsonInternal<T>(
  path: string,
  init: RequestInit & { timeoutMs?: number },
  options: { allowNoContent: boolean },
): Promise<{ status: number; data: T | undefined }> {
  const resp = await controlPlaneFetch(path, init);

  const contentType = resp.headers.get("content-type") ?? "";
  const isJson =
    contentType.includes("application/json") || contentType.includes("+json");

  if (resp.ok && (resp.status === 204 || resp.status === 205)) {
    if (options.allowNoContent) {
      return { status: resp.status, data: undefined };
    }

    throw new ControlPlaneError("Unexpected empty response.", {
      status: 502,
      code: "UNEXPECTED_NO_CONTENT",
    });
  }

  if (resp.ok) {
    if (!isJson) {
      const preview = await resp.text().catch(() => "");
      const snippet = preview.trim().slice(0, 120);
      const hasSnippet = snippet && !snippet.includes("<");
      const details = hasSnippet ? ` body=${JSON.stringify(snippet)}` : "";
      throw new ControlPlaneError(
        `Unexpected response format (content-type=${contentType || "<missing>"})${details}.`,
        { status: 502, code: "NON_JSON_RESPONSE" },
      );
    }

    try {
      return { status: resp.status, data: (await resp.json()) as T };
    } catch {
      throw new ControlPlaneError("Unexpected response format.", {
        status: 502,
        code: "INVALID_JSON",
      });
    }
  }

  let code: string | undefined;
  let message: string | undefined;

  if (isJson) {
    let body: { error?: string; code?: string; message?: string };
    try {
      body = (await resp.json()) as {
        error?: string;
        code?: string;
        message?: string;
      };
    } catch {
      throw new ControlPlaneError("Unexpected response format.", {
        status: 502,
        code: "INVALID_JSON",
      });
    }
    code =
      typeof body.error === "string"
        ? body.error
        : typeof body.code === "string"
          ? body.code
          : undefined;
    message =
      (typeof body.message === "string" ? body.message : undefined) ||
      (typeof body.error === "string" ? body.error : undefined) ||
      undefined;
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

    const snippet = trimmed.slice(0, 120);
    if (snippet && !snippet.includes("<")) {
      message = snippet;
    }
  }

  throw new ControlPlaneError(message || "Control-plane request failed", {
    status: resp.status,
    code,
  });
}

export async function controlPlaneFetchJsonWithStatus<T>(
  path: string,
  init: RequestInit & { timeoutMs?: number },
  options: { allowNoContent: false },
): Promise<{ status: number; data: T }>;
export async function controlPlaneFetchJsonWithStatus<T>(
  path: string,
  init: RequestInit & { timeoutMs?: number },
  options: { allowNoContent: true },
): Promise<{ status: number; data: T | undefined }>;
export async function controlPlaneFetchJsonWithStatus<T>(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {},
  options: { allowNoContent: boolean } = { allowNoContent: false },
): Promise<{ status: number; data: T | undefined }> {
  if (options.allowNoContent) {
    return controlPlaneFetchJsonInternal(path, init, { allowNoContent: true });
  }

  return controlPlaneFetchJsonInternal(path, init, { allowNoContent: false });
}

export async function controlPlaneFetchJson<T>(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const { data } = await controlPlaneFetchJsonWithStatus<T>(path, init, {
    allowNoContent: false,
  });
  return data;
}
