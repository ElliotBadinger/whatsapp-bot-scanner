import {
  createSessionCookieValue,
  isValidSessionCookieValue,
} from "../lib/auth-session";

describe("auth-session", () => {
  it("accepts a freshly generated session cookie", () => {
    const nowMs = 1_700_000_000_000;
    const secret = "test-secret";
    const cookie = createSessionCookieValue({ nowMs, ttlMs: 60_000, secret });

    expect(isValidSessionCookieValue(cookie, { nowMs, secret })).toBe(true);
  });

  it("rejects a tampered session cookie", () => {
    const nowMs = 1_700_000_000_000;
    const secret = "test-secret";
    const cookie = createSessionCookieValue({ nowMs, ttlMs: 60_000, secret });
    const tampered = cookie.replace(/\.[^.]+$/, ".invalid");

    expect(isValidSessionCookieValue(tampered, { nowMs, secret })).toBe(false);
  });

  it("rejects an expired session cookie", () => {
    const nowMs = 1_700_000_000_000;
    const secret = "test-secret";
    const cookie = createSessionCookieValue({ nowMs, ttlMs: 1, secret });

    expect(
      isValidSessionCookieValue(cookie, { nowMs: nowMs + 5_000, secret }),
    ).toBe(false);
  });
});
