import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { fetch, Response } from "undici";
import { config, logger, metrics } from "@wbscanner/shared";

export interface ArtifactPaths {
  screenshotPath: string | null;
  domPath: string | null;
}

type ArtifactType = "screenshot" | "dom";

const ARTIFACT_DIR =
  process.env.URLSCAN_ARTIFACT_DIR || path.resolve("storage/urlscan-artifacts");

async function ensureDirectory(): Promise<void> {
  await fs.mkdir(ARTIFACT_DIR, { recursive: true });
}

function recordDownloadFailure(
  artifactType: ArtifactType,
  reason: string,
): void {
  metrics.artifactDownloadFailures.labels(artifactType, reason).inc();
}

async function downloadToFile(
  artifactType: ArtifactType,
  url: string,
  targetPath: string,
): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    let response: Response | null = null;
    try {
      response = await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
    if (!response?.ok || !response.body) {
      recordDownloadFailure(
        artifactType,
        `http:${response?.status ?? "unknown"}`,
      );
      return false;
    }
    await ensureDirectory();
    await pipeline(response.body, createWriteStream(targetPath));
    return true;
  } catch (error) {
    recordDownloadFailure(
      artifactType,
      `network:${error instanceof Error ? error.name : "unknown"}`,
    );
    logger.warn(
      { url, error, artifactType },
      "Failed to download urlscan artifact",
    );
    return false;
  }
}

/**
 * Sanitize input to prevent path traversal attacks.
 * Only allows alphanumeric characters, hyphens, and underscores.
 */
function sanitizePathComponent(input: string): string {
  // Remove any path separators and special characters that could enable traversal
  const sanitized = input.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!sanitized || sanitized !== input) {
    throw new Error(`Invalid path component: contains disallowed characters`);
  }
  return sanitized;
}

export async function downloadUrlscanArtifacts(
  scanId: string,
  urlHash: string,
): Promise<ArtifactPaths> {
  // Sanitize inputs to prevent path traversal (e.g., "../../../etc/passwd")
  const safeScanId = sanitizePathComponent(scanId);
  const safeUrlHash = sanitizePathComponent(urlHash);

  const screenshotPath = path.join(
    ARTIFACT_DIR,
    `${safeUrlHash}_${safeScanId}.png`,
  );
  const domPath = path.join(ARTIFACT_DIR, `${safeUrlHash}_${safeScanId}.html`);

  // Additional safety: ensure resolved paths are within ARTIFACT_DIR
  const resolvedScreenshot = path.resolve(screenshotPath);
  const resolvedDom = path.resolve(domPath);
  const resolvedArtifactDir = path.resolve(ARTIFACT_DIR);

  if (
    !resolvedScreenshot.startsWith(resolvedArtifactDir) ||
    !resolvedDom.startsWith(resolvedArtifactDir)
  ) {
    throw new Error(
      "Path traversal detected: artifact path escapes artifact directory",
    );
  }

  const baseUrl = (config.urlscan.baseUrl || "https://urlscan.io").replace(
    /\/+$/,
    "",
  );
  const screenshotUrl = `${baseUrl}/screenshots/${scanId}.png`;
  const domUrl = `${baseUrl}/dom/${scanId}/`;

  const screenshotSaved = await downloadToFile(
    "screenshot",
    screenshotUrl,
    screenshotPath,
  );
  if (!screenshotSaved) {
    logger.warn({ scanId, urlHash }, "Screenshot download failed");
  }

  let domSaved = false;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    let response: Response | null = null;
    try {
      response = await fetch(domUrl, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
    if (response?.ok) {
      const html = await response.text();
      await ensureDirectory();
      await fs.writeFile(domPath, html, "utf8");
      domSaved = true;
    } else {
      recordDownloadFailure("dom", `http:${response?.status ?? "unknown"}`);
      logger.warn(
        { scanId, urlHash, status: response?.status },
        "DOM download failed",
      );
    }
  } catch (error) {
    recordDownloadFailure(
      "dom",
      `network:${error instanceof Error ? error.name : "unknown"}`,
    );
    logger.warn({ scanId, urlHash, error }, "Failed to download urlscan DOM");
  }

  return {
    screenshotPath: screenshotSaved ? screenshotPath : null,
    domPath: domSaved ? domPath : null,
  };
}
