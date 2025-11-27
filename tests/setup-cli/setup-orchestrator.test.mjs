import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const LOGS_DIR = path.resolve("logs");
const SETUP_DIR = path.resolve(".setup");
const TEMPLATE_CONTENT = `SCAN_REQUEST_QUEUE=scan-request
SCAN_VERDICT_QUEUE=scan-verdict
SCAN_URLSCAN_QUEUE=scan-urlscan
WA_AUTH_STRATEGY=remote
`;

let originalFetch;
const originalEnv = { ...process.env };

async function cleanupLogs() {
  const target = process.env.SETUP_LOGS_DIR
    ? path.resolve(process.env.SETUP_LOGS_DIR)
    : LOGS_DIR;
  try {
    const entries = await fs.readdir(target);
    await Promise.all(
      entries
        .filter(
          (name) =>
            name.startsWith("setup-") &&
            (name.endsWith(".json") || name.endsWith(".md")),
        )
        .map((name) => fs.rm(path.join(target, name), { force: true })),
    );
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function cleanupPreferences() {
  const cacheDir = process.env.SETUP_CACHE_DIR
    ? path.resolve(process.env.SETUP_CACHE_DIR)
    : SETUP_DIR;
  try {
    await fs.rm(path.join(cacheDir, "preferences.json"), { force: true });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

function resetEnv() {
  process.env = { ...originalEnv };
}

async function createEnvTemplate() {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "setup-cli-"));
  const templatePath = path.join(tmpDir, "env.template");
  await fs.writeFile(templatePath, TEMPLATE_CONTENT, "utf8");
  process.env.SETUP_ENV_TEMPLATE_PATH = templatePath;
  process.env.SETUP_ENV_PATH = path.join(tmpDir, ".env");
  process.env.SETUP_LOGS_DIR = path.join(tmpDir, "logs");
  process.env.SETUP_CACHE_DIR = path.join(tmpDir, "cache");
  await fs.mkdir(process.env.SETUP_LOGS_DIR, { recursive: true });
  await fs.mkdir(process.env.SETUP_CACHE_DIR, { recursive: true });
  await fs.writeFile(process.env.SETUP_ENV_PATH, TEMPLATE_CONTENT, "utf8");
  return { tmpDir, templatePath };
}

async function latestTranscript() {
  const target = process.env.SETUP_LOGS_DIR
    ? path.resolve(process.env.SETUP_LOGS_DIR)
    : LOGS_DIR;
  const entries = await fs.readdir(target).catch(() => []);
  const jsonFiles = entries.filter(
    (name) => name.startsWith("setup-") && name.endsWith(".json"),
  );
  if (jsonFiles.length === 0) return null;
  const stats = await Promise.all(
    jsonFiles.map(async (name) => ({
      name,
      mtime: (await fs.stat(path.join(target, name))).mtimeMs,
    })),
  );
  stats.sort((a, b) => b.mtime - a.mtime);
  return path.join(target, stats[0].name);
}

describe("setup wizard end-to-end (noninteractive)", () => {
  beforeEach(async () => {
    vi.resetModules();
    resetEnv();
    await cleanupLogs();
    await cleanupPreferences();
    originalFetch = global.fetch;
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => "",
      json: async () => ({}),
    }));
    process.env.SETUP_SKIP_PREREQUISITES = "1";
    process.env.SETUP_SKIP_DOCKER = "1";
    process.env.SETUP_SKIP_PORT_CHECKS = "1";
    process.env.NO_COLOR = "1";
  });

  afterEach(async () => {
    global.fetch = originalFetch;
    await cleanupLogs();
    await cleanupPreferences();
  });

  it("walks the full onboarding flow and records checkpoints", async () => {
    const { tmpDir } = await createEnvTemplate();
    const { runSetup } = await import("../../scripts/setup/orchestrator.mjs");
    await runSetup(["--dry-run", "--noninteractive"]);
    const transcriptPath = await latestTranscript();
    expect(transcriptPath).not.toBeNull();
    const transcript = JSON.parse(await fs.readFile(transcriptPath, "utf8"));
    expect(transcript.status).toBe("success");
    expect(transcript.metadata.checkpoints.map((cp) => cp.id)).toEqual([
      "preflight",
      "cleanup",
      "environment",
      "config-validation",
      "api-validation",
      "docker",
      "stabilize",
      "smoke",
    ]);
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("supports resume checkpoints via quick preflight", async () => {
    const { tmpDir } = await createEnvTemplate();
    const { runSetup } = await import("../../scripts/setup/orchestrator.mjs");
    await runSetup(["--quick=preflight", "--dry-run", "--noninteractive"]);
    const transcriptPath = await latestTranscript();
    expect(transcriptPath).not.toBeNull();
    const transcript = JSON.parse(await fs.readFile(transcriptPath, "utf8"));
    expect(transcript.status).toBe("success");
    expect(transcript.metadata.checkpoints.map((cp) => cp.id)).toEqual([
      "preflight",
    ]);
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("purges caches when requested", async () => {
    const { tmpDir } = await createEnvTemplate();
    const { runSetup } = await import("../../scripts/setup/orchestrator.mjs");
    await runSetup(["--dry-run", "--noninteractive"]);
    const firstTranscriptPath = await latestTranscript();
    expect(firstTranscriptPath).not.toBeNull();
    await runSetup(["--quick=purge-caches", "--noninteractive"]);
    const purgeTranscriptPath = await latestTranscript();
    expect(purgeTranscriptPath).not.toBeNull();
    const purgeTranscript = JSON.parse(
      await fs.readFile(purgeTranscriptPath, "utf8"),
    );
    expect(purgeTranscript.status).toBe("success");
    expect(purgeTranscript.events.some((event) => event.type === "purge")).toBe(
      true,
    );
    await fs.rm(tmpDir, { recursive: true, force: true });
  });
});
