import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

describe("robustness fetcher", () => {
  it("deduplicates by registrable domain", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wbscan-fetch-"));
    const exportPath = path.join(tmpDir, "urlscan-export.jsonl");
    const outputDir = path.join(tmpDir, "out");
    const manifestPath = path.join(outputDir, "manifest.json");

    const entries = [
      {
        task: { url: "https://example.com/a" },
        page: { url: "https://example.com/b" },
        verdicts: { overall: { classification: "malicious" } },
      },
      {
        task: { url: "https://example.com/c" },
        page: { url: "https://example.com/d" },
        verdicts: { overall: { classification: "malicious" } },
      },
    ];
    fs.writeFileSync(
      exportPath,
      entries.map((entry) => JSON.stringify(entry)).join("\n"),
      "utf8",
    );

    const result = spawnSync(
      "python",
      [
        "scripts/robustness/fetch-robustness-datasets.py",
        "--output-dir",
        outputDir,
        "--manifest",
        manifestPath,
        "--source",
        "urlscan_export",
      ],
      {
        env: { ...process.env, URLSCAN_EXPORT_PATH: exportPath },
        stdio: "pipe",
      },
    );

    if (result.status !== 0) {
      throw new Error(
        `fetcher failed: ${result.stderr.toString() || result.stdout.toString()}`,
      );
    }

    const outputPath = path.join(outputDir, "sources", "urlscan_export.jsonl");
    const lines = fs
      .readFileSync(outputPath, "utf8")
      .split("\n")
      .filter(Boolean);
    expect(lines.length).toBe(1);

    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
      sources: Array<{ id: string; counts?: Record<string, number> }>;
    };
    const record = manifest.sources.find((entry) => entry.id === "urlscan_export");
    expect(record?.counts?.skipped_dedup_domain).toBe(1);
  });
});
