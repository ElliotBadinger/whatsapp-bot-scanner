import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("undici", () => ({
  __esModule: true,
  request: vi.fn(),
  fetch: vi.fn(),
}));

const dnsLookup = vi.fn().mockResolvedValue([{ address: "93.184.216.34" }]);
vi.mock("node:dns/promises", () => ({
  __esModule: true,
  default: { lookup: dnsLookup },
  lookup: dnsLookup,
}));

const buildResponse = (
  status: number,
  headers: Record<string, string> = {},
) => ({
  status,
  headers: {
    get(name: string) {
      return headers[name.toLowerCase()] ?? null;
    },
  },
  body: {
    cancel: vi.fn().mockResolvedValue(undefined),
  },
});

beforeEach(() => {
  dnsLookup.mockResolvedValue([{ address: "93.184.216.34" }]);
});

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  dnsLookup.mockReset();
  dnsLookup.mockResolvedValue([{ address: "93.184.216.34" }]);
});

describe("Shortener fallback chain (direct expansion)", () => {
  it("returns original URL when Unshorten and direct expansion fail", async () => {
    const undici = await import("undici");

    vi.mocked(undici.request).mockResolvedValue({ statusCode: 500 } as any);
    vi.mocked(undici.fetch).mockResolvedValue(buildResponse(404) as any);

    const { resolveShortener } = await import("@wbscanner/shared");

    const result = await resolveShortener("http://bit.ly/down");
    expect(result.provider).toBe("original");
    expect(result.expanded).toBe(false);
    expect(result.reason).toBe("expansion-failed");
    expect(result.error).toBe("Service unavailable");
  });

  it("uses direct expansion when Unshorten fails", async () => {
    const undici = await import("undici");

    vi.mocked(undici.request).mockResolvedValue({ statusCode: 500 } as any);
    vi.mocked(undici.fetch)
      .mockResolvedValueOnce(
        buildResponse(301, {
          location: "https://expanded.example/path",
        }) as any,
      )
      .mockResolvedValueOnce(buildResponse(200) as any);

    const { resolveShortener } = await import("@wbscanner/shared");

    const result = await resolveShortener("http://bit.ly/demo");
    expect(result.provider).toBe("direct");
    expect(result.finalUrl).toBe("https://expanded.example/path");
    expect(result.chain).toContain("https://expanded.example/path");
    expect(result.expanded).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("blocks direct expansion results that resolve to private addresses", async () => {
    const undici = await import("undici");

    vi.mocked(undici.request).mockResolvedValue({ statusCode: 500 } as any);
    vi.mocked(undici.fetch).mockResolvedValueOnce(
      buildResponse(301, { location: "http://127.0.0.1/admin" }) as any,
    );

    dnsLookup.mockResolvedValueOnce([{ address: "93.184.216.34" }]);
    dnsLookup.mockResolvedValueOnce([{ address: "127.0.0.1" }]);

    const { resolveShortener } = await import("@wbscanner/shared");

    const result = await resolveShortener("http://bit.ly/private");
    expect(result.provider).toBe("original");
    expect(result.expanded).toBe(false);
    expect(result.reason).toBe("ssrf-blocked");
    expect(result.error).toContain("SSRF protection");
  });

  it("flags responses above the content-length cap", async () => {
    const undici = await import("undici");

    vi.mocked(undici.request).mockResolvedValue({ statusCode: 500 } as any);
    vi.mocked(undici.fetch).mockResolvedValueOnce(
      buildResponse(200, { "content-length": "2097152" }) as any,
    );

    const { resolveShortener } = await import("@wbscanner/shared");

    const result = await resolveShortener("http://bit.ly/oversized");
    expect(result.provider).toBe("original");
    expect(result.expanded).toBe(false);
    expect(result.reason).toBe("max-content-length");
    expect(result.error).toContain("Content too large");
  });

  it("reports timeouts from the direct fetch fallback", async () => {
    const undici = await import("undici");

    vi.mocked(undici.request).mockResolvedValue({ statusCode: 500 } as any);
    const abortError = new Error("Aborted");
    abortError.name = "AbortError";
    vi.mocked(undici.fetch).mockRejectedValue(abortError);

    const { resolveShortener } = await import("@wbscanner/shared");

    const result = await resolveShortener("http://bit.ly/timeout");
    expect(result.provider).toBe("original");
    expect(result.expanded).toBe(false);
    expect(result.reason).toBe("timeout");
    expect(result.error).toContain("timed out");
  });
});
