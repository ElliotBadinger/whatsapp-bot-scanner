import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fetch } from 'undici';
import { config, logger, metrics, isForbiddenHostname, isHostnameAllowListed } from '@wbscanner/shared';

export interface ArtifactPaths {
  screenshotPath: string | null;
  domPath: string | null;
}

type ArtifactType = 'screenshot' | 'dom';

const ARTIFACT_ROOT = path.resolve(process.env.URLSCAN_ARTIFACT_DIR || path.resolve('storage/urlscan-artifacts'));

async function ensureDirectory(): Promise<void> {
  await fs.mkdir(ARTIFACT_ROOT, { recursive: true });
}

function sanitizeSegment(segment: string, fallback: string): string {
  const cleaned = segment.replace(/[^a-zA-Z0-9_-]/g, '');
  return cleaned.length > 0 ? cleaned : fallback;
}

function resolveArtifactPath(filename: string): string {
  const resolved = path.resolve(ARTIFACT_ROOT, filename);
  if (!resolved.startsWith(`${ARTIFACT_ROOT}${path.sep}`) && resolved !== ARTIFACT_ROOT) {
    throw new Error('Refused to write artifact outside of artifact root');
  }
  return resolved;
}

async function validateArtifactUrl(artifactType: ArtifactType, url: string): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    recordDownloadFailure(artifactType, 'invalid_url');
    return false;
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    recordDownloadFailure(artifactType, 'invalid_protocol');
    return false;
  }

  const hostname = parsed.hostname.toLowerCase();
  const allowList = config.urlscan.allowedArtifactHosts;
  if (allowList.length > 0 && !isHostnameAllowListed(hostname, allowList)) {
    recordDownloadFailure(artifactType, 'forbidden_host');
    logger.warn({ artifactType, hostname }, 'Blocked urlscan artifact download due to host allowlist');
    return false;
  }

  if (await isForbiddenHostname(hostname)) {
    recordDownloadFailure(artifactType, 'forbidden_host');
    logger.warn({ artifactType, hostname }, 'Blocked urlscan artifact download due to SSRF protections');
    return false;
  }

  if (parsed.port) {
    const port = Number.parseInt(parsed.port, 10);
    if (!Number.isFinite(port) || port <= 0 || port > 65535) {
      recordDownloadFailure(artifactType, 'invalid_port');
      return false;
    }
  }

  return true;
}

function recordDownloadFailure(artifactType: ArtifactType, reason: string): void {
  metrics.artifactDownloadFailures.labels(artifactType, reason).inc();
}

async function downloadToFile(artifactType: ArtifactType, url: string, targetPath: string): Promise<boolean> {
  try {
    if (!(await validateArtifactUrl(artifactType, url))) {
      return false;
    }

    const targetDirectory = path.dirname(targetPath);
    if (!targetDirectory.startsWith(`${ARTIFACT_ROOT}${path.sep}`) && targetDirectory !== ARTIFACT_ROOT) {
      recordDownloadFailure(artifactType, 'invalid_path');
      return false;
    }

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
    logger.warn({ error, artifactType }, 'Failed to download urlscan artifact');
    return false;
  }
}

export async function downloadUrlscanArtifacts(scanId: string, urlHash: string): Promise<ArtifactPaths> {
  const safeHash = sanitizeSegment(urlHash, 'unknown');
  const safeScanId = sanitizeSegment(scanId, 'scan');
  const screenshotPath = resolveArtifactPath(`${safeHash}_${safeScanId}.png`);
  const domPath = resolveArtifactPath(`${safeHash}_${safeScanId}.html`);
  const baseUrl = (config.urlscan.baseUrl || 'https://urlscan.io').replace(/\/+$/, '');
  const screenshotUrl = `${baseUrl}/screenshots/${scanId}.png`;
  const domUrl = `${baseUrl}/dom/${scanId}/`;

  const screenshotSaved = await downloadToFile('screenshot', screenshotUrl, screenshotPath);
  if (!screenshotSaved) {
    logger.warn({ scanId, urlHash }, 'Screenshot download failed');
  }

  let domSaved = false;
  if (await validateArtifactUrl('dom', domUrl)) {
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
  }

  return {
    screenshotPath: screenshotSaved ? screenshotPath : null,
    domPath: domSaved ? domPath : null,
  };
}
