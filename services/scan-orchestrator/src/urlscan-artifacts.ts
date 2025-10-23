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

type ArtifactType = 'screenshot' | 'dom';

const ARTIFACT_DIR = process.env.URLSCAN_ARTIFACT_DIR || path.resolve('storage/urlscan-artifacts');

async function ensureDirectory(): Promise<void> {
  await fs.mkdir(ARTIFACT_DIR, { recursive: true });
}

function recordDownloadFailure(artifactType: ArtifactType, reason: string): void {
  metrics.artifactDownloadFailures.labels(artifactType, reason).inc();
}

async function downloadToFile(artifactType: ArtifactType, url: string, targetPath: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    let response: any = null;
    try {
      response = await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
    if (!response?.ok || !response.body) {
      recordDownloadFailure(artifactType, `http:${response?.status ?? 'unknown'}`);
      return false;
    }
    await ensureDirectory();
    await pipeline(response.body, createWriteStream(targetPath));
    return true;
  } catch (error) {
    recordDownloadFailure(artifactType, `network:${error instanceof Error ? error.name : 'unknown'}`);
    logger.warn({ url, error, artifactType }, 'Failed to download urlscan artifact');
    return false;
  }
}

export async function downloadUrlscanArtifacts(scanId: string, urlHash: string): Promise<ArtifactPaths> {
  const screenshotPath = path.join(ARTIFACT_DIR, `${urlHash}_${scanId}.png`);
  const domPath = path.join(ARTIFACT_DIR, `${urlHash}_${scanId}.html`);
  const baseUrl = (config.urlscan.baseUrl || 'https://urlscan.io').replace(/\/+$/, '');
  const screenshotUrl = `${baseUrl}/screenshots/${scanId}.png`;
  const domUrl = `${baseUrl}/dom/${scanId}/`;

  const screenshotSaved = await downloadToFile('screenshot', screenshotUrl, screenshotPath);
  if (!screenshotSaved) {
    logger.warn({ scanId, urlHash }, 'Screenshot download failed');
  }

  let domSaved = false;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    let response: any = null;
    try {
      response = await fetch(domUrl, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
    if (response?.ok) {
      const html = await response.text();
      await ensureDirectory();
      await fs.writeFile(domPath, html, 'utf8');
      domSaved = true;
    } else {
      recordDownloadFailure('dom', `http:${response?.status ?? 'unknown'}`);
      logger.warn({ scanId, urlHash, status: response?.status }, 'DOM download failed');
    }
  } catch (error) {
    recordDownloadFailure('dom', `network:${error instanceof Error ? error.name : 'unknown'}`);
    logger.warn({ scanId, urlHash, error }, 'Failed to download urlscan DOM');
  }

  return {
    screenshotPath: screenshotSaved ? screenshotPath : null,
    domPath: domSaved ? domPath : null,
  };
}
