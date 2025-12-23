
import { isSuspiciousTld, normalizeUrl, isForbiddenHostname } from "../src/url";

// Save original env
const originalEnv = process.env.WA_FORBIDDEN_HOSTNAMES;

afterAll(() => {
  process.env.WA_FORBIDDEN_HOSTNAMES = originalEnv;
});

describe("URL Optimization Tests", () => {
  test("isSuspiciousTld works correctly", () => {
    expect(isSuspiciousTld("example.zip")).toBe(true);
    expect(isSuspiciousTld("google.com")).toBe(false);
    expect(isSuspiciousTld("test.xyz")).toBe(true);
    expect(isSuspiciousTld("example.co.uk")).toBe(false);
  });

  test("normalizeUrl strips tracking params", () => {
    const url = "https://example.com/path?utm_source=google&utm_medium=cpc&keep=me";
    const normalized = normalizeUrl(url);
    expect(normalized).toBe("https://example.com/path?keep=me");
  });

  test("normalizeUrl handles clean URLs", () => {
    const url = "https://example.com/path";
    const normalized = normalizeUrl(url);
    expect(normalized).toBe("https://example.com/path");
  });

  test("isForbiddenHostname works with env vars", async () => {
    process.env.WA_FORBIDDEN_HOSTNAMES = "bad.com,evil.org";
    expect(await isForbiddenHostname("bad.com")).toBe(true);
    expect(await isForbiddenHostname("good.com")).toBe(false);
    expect(await isForbiddenHostname("sub.bad.com")).toBe(true);

    // Change env var to verify cache invalidation
    process.env.WA_FORBIDDEN_HOSTNAMES = "worse.com";
    // We expect the function to pick up the change because we implemented cache invalidation based on env string
    expect(await isForbiddenHostname("bad.com")).toBe(false);
    expect(await isForbiddenHostname("worse.com")).toBe(true);
  });
});
