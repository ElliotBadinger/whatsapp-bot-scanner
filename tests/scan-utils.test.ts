import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { scanJsonlGrouped, summarizeBucket } from "../scripts/scan-utils";

describe("scan-utils fixtures and metrics", () => {
  it("applies offline fixture signals and computes metrics", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wbscan-"));
    const filePath = path.join(tmpDir, "fixtures.jsonl");
    const fixtures = [
      {
        url: "https://bit.ly/abc",
        inputUrl: "https://bit.ly/abc",
        finalUrl: "https://example.com/login?redirect=https://evil.test",
        redirectChain: [
          "https://bit.ly/abc",
          "https://example.com/login?redirect=https://evil.test",
        ],
        label: "tricky",
        source: "synthetic",
      },
      {
        url: "https://benign.example/path",
        label: "benign",
        source: "synthetic",
      },
    ];
    fs.writeFileSync(
      filePath,
      fixtures.map((entry) => JSON.stringify(entry)).join("\n"),
      "utf8",
    );

    const seen: Array<{ url: string; extraSignals?: Record<string, unknown> }> =
      [];
    const verdictByUrl: Record<string, "benign" | "suspicious" | "malicious"> =
      {
        "https://bit.ly/abc": "suspicious",
        "https://benign.example/path": "suspicious",
      };

    const scanFn = async (url: string, options: { extraSignals?: unknown }) => {
      seen.push({ url, extraSignals: options.extraSignals as Record<string, unknown> });
      return {
        inputUrl: url,
        normalizedUrl: url,
        finalUrl: url,
        redirectChain: [],
        verdict: {
          level: verdictByUrl[url],
          score: 5,
          reasons: ["test"],
          cacheTtl: 60,
        },
        signals: {},
      };
    };

    const { buckets } = await scanJsonlGrouped(filePath, { scanFn });
    const bucket = buckets.all;
    expect(bucket).toBeDefined();

    const summary = summarizeBucket(bucket);
    expect(summary.tricky.expected).toBe(1);
    expect(summary.tricky.flaggedRate).toBe(1);
    expect(summary.tricky.blockRate).toBe(0);
    expect(summary.precisionByLabel.suspicious).toBe(0.5);
    expect(summary.recallByLabel.suspicious).toBe(1);
    expect(summary.flagged.precision).toBe(0.5);
    expect(summary.flagged.fpr).toBe(1);

    const first = seen[0];
    expect(first.url).toBe("https://bit.ly/abc");
    expect(first.extraSignals?.redirectCount).toBe(2);
    expect(first.extraSignals?.wasShortened).toBe(true);
    expect(first.extraSignals?.finalUrlMismatch).toBe(true);
    expect(first.extraSignals?.hasRedirectParam).toBe(true);
  });
});
