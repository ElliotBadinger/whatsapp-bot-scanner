import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("undici", () => ({
  __esModule: true,
  request: vi.fn(),
}));

afterEach(async () => {
  delete process.env.WHOISXML_MONTHLY_QUOTA;
  const shared = await import("@wbscanner/shared");
  shared.register.resetMetrics();
  vi.clearAllMocks();
  vi.resetModules();
});

beforeEach(() => {
  process.env.WHOISXML_MONTHLY_QUOTA = "1";
});

describe("WhoisXML quota enforcement", () => {
  it("disables lookups when monthly quota reached", async () => {
    const undici = await import("undici");
    vi.mocked(undici.request).mockResolvedValue({
      statusCode: 200,
      body: {
        json: async () => ({
          WhoisRecord: {
            domainName: "example.test",
            createdDate: "2020-01-01",
          },
        }),
      },
    } as any);

    const { whoisXmlLookup, QuotaExceededError, register } = await import(
      "@wbscanner/shared"
    );

    const first = await whoisXmlLookup("example.test");
    expect(first.record?.domainName).toBe("example.test");

    await expect(whoisXmlLookup("example.test")).rejects.toBeInstanceOf(
      QuotaExceededError,
    );

    const metrics = await register.metrics();
    expect(metrics).toMatch(
      /wbscanner_api_quota_status\{service="whoisxml"\} 0/,
    );
    expect(metrics).toMatch(
      /wbscanner_whois_results_total\{result="success"\} 1/,
    );
    expect(metrics).toMatch(
      /wbscanner_whois_results_total\{result="quota_exhausted"\} 1/,
    );
  });
});
