import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("undici", () => ({ fetch: vi.fn() }));

afterEach(async () => {
  vi.useRealTimers();
  const shared = await import("@wbscanner/shared");
  shared.register.resetMetrics();
  vi.clearAllMocks();
  vi.resetModules();
});

describe("VirusTotal quota handling", () => {
  it("throttles submissions above the 4 req/min window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));

    process.env.VT_API_KEY = "test-key";
    process.env.VT_REQUESTS_PER_MINUTE = "4";
    process.env.VT_REQUEST_JITTER_MS = "0";

    const fetchMock = vi.mocked((await import("undici")).fetch);
    const submissionTimestamps: number[] = [];
    fetchMock.mockImplementation(async (input: any) => {
      const url =
        typeof input === "string"
          ? input
          : (input?.url ?? input?.href ?? String(input));
      if (url.includes("/api/v3/urls")) {
        submissionTimestamps.push(Date.now());
        return {
          status: 200,
          json: async () => ({
            data: { id: `analysis-${submissionTimestamps.length}` },
          }),
        } as any;
      }
      return {
        status: 200,
        json: async () => ({ data: { attributes: { status: "completed" } } }),
      } as any;
    });

    const { vtAnalyzeUrl } = await import("@wbscanner/shared");

    const analyses = Array.from({ length: 5 }, (_, idx) =>
      vtAnalyzeUrl(`http://example.test/${idx}`),
    );
    const allAnalyses = Promise.all(analyses);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(submissionTimestamps).toHaveLength(5);

    await vi.advanceTimersByTimeAsync(120_000);
    await allAnalyses;

    const elapsed = submissionTimestamps[4] - submissionTimestamps[0];
    expect(elapsed).toBeGreaterThanOrEqual(60_000);
    expect(elapsed).toBeLessThan(75_000);
  });

  it("throws QuotaExceededError and flips quota gauge on HTTP 429", async () => {
    const fetchMock = vi.mocked((await import("undici")).fetch);
    fetchMock.mockResolvedValueOnce({
      status: 429,
      json: async () => ({}),
    } as any);

    const { vtAnalyzeUrl, QuotaExceededError, register } = await import(
      "@wbscanner/shared"
    );

    await expect(vtAnalyzeUrl("http://example.test")).rejects.toBeInstanceOf(
      QuotaExceededError,
    );

    const metrics = await register.metrics();
    expect(metrics).toMatch(
      /wbscanner_api_quota_status\{service="virustotal"\} 0/,
    );
    expect(metrics).toMatch(
      /wbscanner_api_quota_depleted_total\{service="virustotal"\} 1/,
    );
  });
});
