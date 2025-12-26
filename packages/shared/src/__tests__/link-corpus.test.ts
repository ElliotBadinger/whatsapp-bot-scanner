/* eslint-disable @typescript-eslint/no-var-requires */
const {
  parseUrlList,
  parseMajesticCsv,
  parseSansDomainData,
  generateTrickyUrls,
  dedupeEntries,
} = require("../../../../scripts/link-corpus");

describe("link corpus helpers", () => {
  test("parseUrlList filters comments and non-urls", () => {
    const input = [
      "# comment",
      "http://Example.com/path",
      "not-a-url",
      "https://ok.test",
      "",
    ].join("\n");

    expect(parseUrlList(input, 10)).toEqual([
      "http://example.com/path",
      "https://ok.test/",
    ]);
  });

  test("parseMajesticCsv extracts domains", () => {
    const csv = [
      "GlobalRank,TldRank,Domain,TLD,RefSubNets,RefIPs",
      "1,1,google.com,com,123,456",
      "2,2,example.org,org,10,20",
    ].join("\n");

    expect(parseMajesticCsv(csv, 10)).toEqual(["google.com", "example.org"]);
  });

  test("parseSansDomainData accepts JSON array and score filter", () => {
    const payload = JSON.stringify([
      { domain: "bad.test", score: 9 },
      { domain: "low.test", score: 2 },
    ]);

    expect(parseSansDomainData(payload, 5, 10)).toEqual(["bad.test"]);
  });

  test("parseSansDomainData accepts JSON lines", () => {
    const payload = [
      JSON.stringify({ domain: "line.test", score: 7 }),
      JSON.stringify({ domain: "low.test", score: 1 }),
    ].join("\n");

    expect(parseSansDomainData(payload, 6, 10)).toEqual(["line.test"]);
  });

  test("generateTrickyUrls mixes userinfo and homoglyph variants", () => {
    const tricky = generateTrickyUrls(
      ["google.com"],
      ["http://bad.test/path"],
      5,
    );

    expect(tricky.some((url: string) => url.includes("@bad.test"))).toBe(true);
    expect(tricky.some((url: string) => url.includes("xn--"))).toBe(true);
  });

  test("dedupeEntries keeps higher priority labels", () => {
    const entries = [
      { url: "https://dup.test", label: "benign" },
      { url: "https://dup.test", label: "malicious" },
    ];

    const deduped = dedupeEntries(entries);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].label).toBe("malicious");
  });
});
