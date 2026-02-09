import crypto from "node:crypto";

export const CSRF_COOKIE = "safemode_admin_csrf";

export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
