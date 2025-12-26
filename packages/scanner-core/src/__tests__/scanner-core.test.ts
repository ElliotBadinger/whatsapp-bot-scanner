import { extractUrls, scanTextMessage, scanUrl } from "../index";

const sampleText = "Check https://example.com and example.org/path?a=1#frag";

describe("scanner-core", () => {
  it("extracts and normalizes urls from text", () => {
    const urls = extractUrls(sampleText);
    expect(urls).toEqual(
      expect.arrayContaining([
        "https://example.com",
        "https://example.org/path",
      ]),
    );
  });

  it("scans a single url with heuristic-only defaults", async () => {
    const result = await scanUrl("https://example.com/test?utm_source=news#frag");
    expect(result.finalUrl).toBe("https://example.com/test");
    expect(result.verdict.level).toBeDefined();
    expect(result.signals.heuristicsOnly).toBe(true);
  });

  it("scans text messages with de-duplication", async () => {
    const results = await scanTextMessage({ text: "Visit https://a.test and https://a.test" });
    expect(results).toHaveLength(1);
    expect(results[0].normalizedUrl).toBe("https://a.test/");
  });
});
