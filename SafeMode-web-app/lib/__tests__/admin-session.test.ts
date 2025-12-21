import {
  createAdminSessionToken,
  getCookieFromHeader,
  verifyAdminSessionToken,
} from "../admin-session";

describe("admin-session", () => {
  it("creates a token that can be verified", () => {
    const { token, session } = createAdminSessionToken({
      secret: "test-secret-32-characters-minimum-aaaa",
      ttlSeconds: 60,
      nowMs: 1_000_000,
    });

    const verified = verifyAdminSessionToken({
      token,
      secret: "test-secret-32-characters-minimum-aaaa",
      nowMs: 1_000_000,
    });

    expect(verified).toEqual(session);
  });

  it("rejects an expired token", () => {
    const { token } = createAdminSessionToken({
      secret: "test-secret-32-characters-minimum-aaaa",
      ttlSeconds: 1,
      nowMs: 1_000,
    });

    const verified = verifyAdminSessionToken({
      token,
      secret: "test-secret-32-characters-minimum-aaaa",
      nowMs: 5_000,
    });

    expect(verified).toBeNull();
  });

  it("rejects a token with an invalid signature", () => {
    const { token } = createAdminSessionToken({
      secret: "test-secret-32-characters-minimum-aaaa",
      ttlSeconds: 60,
      nowMs: 1_000,
    });

    const verified = verifyAdminSessionToken({
      token,
      secret: "different-secret-32-characters-minimum-bbbb",
      nowMs: 1_000,
    });

    expect(verified).toBeNull();
  });

  it("extracts cookie values from a header", () => {
    const header =
      "a=b; safemode_admin_session=token123;  safemode_admin_csrf=csrf456";

    expect(getCookieFromHeader(header, "safemode_admin_session")).toBe(
      "token123",
    );
    expect(getCookieFromHeader(header, "missing")).toBeNull();
  });
});
