import { CSRF_COOKIE_NAME } from "./csrf-shared";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${encodeURIComponent(name)}=`;
  const parts = document.cookie.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      return decodeURIComponent(trimmed.slice(prefix.length));
    }
  }
  return null;
}

let inflight: Promise<string> | null = null;

export function getCsrfTokenFromCookie(): string | null {
  return readCookie(CSRF_COOKIE_NAME);
}

export async function ensureCsrfToken(): Promise<string> {
  const existing = getCsrfTokenFromCookie();
  if (existing) return existing;
  if (inflight) return inflight;

  inflight = fetch("/api/auth/csrf", {
    method: "GET",
    headers: { accept: "application/json" },
    cache: "no-store",
  })
    .then(async (resp) => {
      const body = (await resp.json().catch(() => null)) as {
        csrfToken?: string;
      } | null;
      if (!resp.ok || !body || typeof body.csrfToken !== "string") {
        throw new Error("Failed to fetch CSRF token");
      }

      return body.csrfToken;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}
