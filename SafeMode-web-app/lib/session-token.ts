import crypto from "node:crypto";

export interface SessionTokenClaims {
  iat: number;
  exp: number;
}

export const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 24;

export function createSignedSessionToken(options: {
  secret: string;
  ttlSeconds?: number;
  nowMs?: number;
}): { token: string; claims: SessionTokenClaims } {
  const ttlSeconds = options.ttlSeconds ?? DEFAULT_SESSION_TTL_SECONDS;
  const nowMs = options.nowMs ?? Date.now();
  const nowSeconds = Math.floor(nowMs / 1000);

  const claims: SessionTokenClaims = {
    iat: nowSeconds,
    exp: nowSeconds + ttlSeconds,
  };

  const payload = Buffer.from(JSON.stringify(claims), "utf8").toString(
    "base64url",
  );
  const signature = crypto
    .createHmac("sha256", options.secret)
    .update(payload)
    .digest("base64url");

  return { token: `${payload}.${signature}`, claims };
}

export type VerifySignedSessionTokenResult =
  | { ok: true; claims: SessionTokenClaims }
  | {
      ok: false;
      reason:
        | "invalid_format"
        | "invalid_signature"
        | "invalid_claims"
        | "expired";
    };

export function verifySignedSessionToken(
  token: string,
  options: { secret: string; nowMs?: number },
): VerifySignedSessionTokenResult {
  const parts = token.split(".");
  if (parts.length !== 2) {
    return { ok: false, reason: "invalid_format" };
  }

  const [payload, signature] = parts;
  if (!payload || !signature) {
    return { ok: false, reason: "invalid_format" };
  }

  const expectedSigBuffer = crypto
    .createHmac("sha256", options.secret)
    .update(payload)
    .digest();
  let providedSigBuffer: Buffer;
  try {
    providedSigBuffer = Buffer.from(signature, "base64url");
  } catch {
    return { ok: false, reason: "invalid_format" };
  }

  if (providedSigBuffer.length !== expectedSigBuffer.length) {
    return { ok: false, reason: "invalid_signature" };
  }

  if (!crypto.timingSafeEqual(providedSigBuffer, expectedSigBuffer)) {
    return { ok: false, reason: "invalid_signature" };
  }

  let parsedClaims: unknown;
  try {
    parsedClaims = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
  } catch {
    return { ok: false, reason: "invalid_claims" };
  }

  if (!parsedClaims || typeof parsedClaims !== "object") {
    return { ok: false, reason: "invalid_claims" };
  }

  const claims = parsedClaims as { iat?: unknown; exp?: unknown };
  const iat = typeof claims.iat === "number" ? claims.iat : Number.NaN;
  const exp = typeof claims.exp === "number" ? claims.exp : Number.NaN;
  if (!Number.isFinite(iat) || !Number.isFinite(exp) || exp <= iat) {
    return { ok: false, reason: "invalid_claims" };
  }

  const nowSeconds = Math.floor((options.nowMs ?? Date.now()) / 1000);
  if (nowSeconds >= exp) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true, claims: { iat, exp } };
}
