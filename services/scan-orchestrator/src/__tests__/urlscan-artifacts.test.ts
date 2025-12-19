jest.mock("undici", () => ({
  fetch: jest.fn(),
}));

jest.mock("@wbscanner/shared", () => ({
  config: { urlscan: { baseUrl: "https://urlscan.test" } },
  logger: { warn: jest.fn() },
  metrics: {
    artifactDownloadFailures: { labels: () => ({ inc: jest.fn() }) },
  },
}));

jest.mock("node:fs/promises", () => ({
  mkdir: jest.fn(async () => undefined),
  writeFile: jest.fn(async () => undefined),
}));

jest.mock("node:fs", () => ({
  createWriteStream: jest.fn(() => ({})),
}));

jest.mock("node:stream/promises", () => ({
  pipeline: jest.fn(async () => undefined),
}));

const { fetch: fetchMock } = jest.requireMock("undici") as {
  fetch: jest.Mock;
};

describe("downloadUrlscanArtifacts", () => {
  let downloadUrlscanArtifacts: typeof import("../urlscan-artifacts").downloadUrlscanArtifacts;

  beforeAll(async () => {
    process.env.URLSCAN_ARTIFACT_DIR = "/tmp/urlscan-test";
    ({ downloadUrlscanArtifacts } = await import("../urlscan-artifacts"));
  });

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("rejects invalid identifiers", async () => {
    await expect(
      downloadUrlscanArtifacts("bad-scan", "bad-hash"),
    ).rejects.toThrow("Invalid scan id");
  });

  it("returns paths when downloads succeed", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        body: {},
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => "<html/>",
      });

    const scanId = "123e4567-e89b-12d3-a456-426614174000";
    const urlHash = "a".repeat(64);

    const result = await downloadUrlscanArtifacts(scanId, urlHash);
    expect(result.screenshotPath).toContain(urlHash);
    expect(result.domPath).toContain(urlHash);
  });

  it("returns null screenshot path on failed fetch", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        body: null,
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => "<html/>",
      });

    const scanId = "123e4567-e89b-12d3-a456-426614174000";
    const urlHash = "b".repeat(64);

    const result = await downloadUrlscanArtifacts(scanId, urlHash);
    expect(result.screenshotPath).toBeNull();
    expect(result.domPath).toContain(urlHash);
  });
});
