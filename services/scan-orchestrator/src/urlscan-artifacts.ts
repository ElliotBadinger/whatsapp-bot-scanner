import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fetch } from 'undici';
import { config, logger, metrics } from '@wbscanner/shared';

export interface ArtifactPaths {
  screenshotPath: string | null;
  domPath: string | null;
}

const ARTIFACT_DIR = process.env.URLSCAN_ARTIFACT_DIR || path.resolve('storage/urlscan-artifacts');

async function ensureDirectory(): Promise<void> {
  await fs.mkdir(ARTIFACT_DIR, { recursive: true });
}

async function downloadToFile(url: string, targetPath: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    let response: any = null;
    try {
      response = await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok || !response.body) {
      metrics.artifactDownloadFailures.labels('http', String(response.status)).inc();
      return false;
    }
    await ensureDirectory();
    await pipeline(response.body, createWriteStream(targetPath));
    return true;
  } catch (error) {
    metrics.artifactDownloadFailures.labels('network', error instanceof Error ? error.name : 'unknown').inc();
    logger.warn({ url, error }, 'Failed to download urlscan artifact');
    return false;
  }
}

export async function downloadUrlscanArtifacts(scanId: string, urlHash: string): Promise<ArtifactPaths> {
  const screenshotPath = path.join(ARTIFACT_DIR, `${urlHash}_${scanId}.png`);
  const domPath = path.join(ARTIFACT_DIR, `${urlHash}_${scanId}.html`);
  const baseUrl = (config.urlscan.baseUrl || 'https://urlscan.io').replace(/\/+$/, '');
  const screenshotUrl = `${baseUrl}/screenshots/${scanId}.png`;
  const domUrl = `${baseUrl}/dom/${scanId}/`;

  let screenshotSaved = false;
  let domSaved = false;

  screenshotSaved = await downloadToFile(screenshotUrl, screenshotPath);
  if (!screenshotSaved) {
    logger.warn({ scanId, urlHash }, 'Screenshot download failed');
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    let response: any = null;
    try {
      response = await fetch(domUrl, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
    if (response.ok) {
      const html = await response.text();
      await ensureDirectory();
      await fs.writeFile(domPath, html, 'utf8');
      domSaved = true;
    } else {
      metrics.artifactDownloadFailures.labels('http', String(response.status)).inc();
      logger.warn({ scanId, urlHash, status: response.status }, 'DOM download failed');
    }
  } catch (error) {
    metrics.artifactDownloadFailures.labels('network', error instanceof Error ? error.name : 'unknown').inc();
    logger.warn({ scanId, urlHash, error }, 'Failed to download urlscan DOM');
  }

  return {
    screenshotPath: screenshotSaved ? screenshotPath : null,
    domPath: domSaved ? domPath : null,
  };
}
