import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("undici", () => ({
  __esModule: true,
  request: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("Google Safe Browsing mock integration", () => {
  it("returns normalized matches from mocked response", async () => {
    const undici = await import("undici");
    vi.mocked(undici.request).mockResolvedValueOnce({
      statusCode: 200,
      body: {
        json: async () => ({
          matches: [
            {
              threatType: "MALWARE",
              platformType: "ANY_PLATFORM",
              threatEntryType: "URL",
              threat: { url: "http://malware.test" },
            },
          ],
        }),
      },
    } as any);

    const { gsbLookup } = await import("@wbscanner/shared");
    const result = await gsbLookup(["http://malware.test"]);

    expect(result.matches).toEqual([
      {
        threatType: "MALWARE",
        platformType: "ANY_PLATFORM",
        threatEntryType: "URL",
        threat: "http://malware.test",
      },
    ]);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("throws on server errors", async () => {
    const undici = await import("undici");
    vi.mocked(undici.request).mockResolvedValueOnce({
      statusCode: 503,
      body: { json: async () => ({}) },
    } as any);

    const { gsbLookup } = await import("@wbscanner/shared");
    await expect(gsbLookup(["http://example.test"])).rejects.toMatchObject({
      message: "Google Safe Browsing error: 503",
    });
  });
});
