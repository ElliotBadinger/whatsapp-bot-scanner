import fs from 'node:fs/promises';
import path from 'node:path';
import { fetch } from 'undici';
import { config, logger, metrics, isPrivateHostname, sanitizeForLogging } from '@wbscanner/shared';

export interface ArtifactPaths {
  screenshotPath: string | null;
  domPath: string | null;
}

type ArtifactType = 'screenshot' | 'dom';

const ARTIFACT_DIR = path.resolve(process.env.URLSCAN_ARTIFACT_DIR || 'storage/urlscan-artifacts');
const MAX_ARTIFACT_BYTES = 5 * 1024 * 1024;
const allowedUrlscanHosts = new Set(
  (config.security.externalFetchAllowlist.length > 0
    ? config.security.externalFetchAllowlist
    : ['urlscan.io'])
    .map((host) => host.toLowerCase())
);

function sanitizeFileSegment(segment: string): string {
  return segment.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function isAllowedUrlscanHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  for (const allowed of allowedUrlscanHosts) {
    if (normalized === allowed || normalized.endsWith(`.${allowed}`)) {
      return true;
    }
  }
  return false;
}

async function getSafeUrlscanBase(rawBase: string): Promise<string | null> {
  try {
    const parsed = new URL(rawBase);
    if (!['https:'].includes(parsed.protocol)) {
      return null;
    }
    if (await isPrivateHostname(parsed.hostname)) {
      return null;
    }
    if (!isAllowedUrlscanHost(parsed.hostname)) {
      return null;
    }
    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return null;
  }
}

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
    if (!response?.ok) {
      recordDownloadFailure(artifactType, `http:${response?.status ?? 'unknown'}`);
      return false;
    }
    const contentLengthHeader = typeof response.headers?.get === 'function'
      ? response.headers.get('content-length')
      : undefined;
    if (contentLengthHeader) {
      const declared = Number.parseInt(contentLengthHeader, 10);
      if (Number.isFinite(declared) && declared > MAX_ARTIFACT_BYTES) {
        recordDownloadFailure(artifactType, 'size_exceeded');
        logger.warn({ url: sanitizeForLogging(url), artifactType }, 'Urlscan artifact declared size above limit');
        return false;
      }
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > MAX_ARTIFACT_BYTES) {
      recordDownloadFailure(artifactType, 'size_exceeded');
      logger.warn({ url: sanitizeForLogging(url), artifactType }, 'Urlscan artifact exceeded size limit');
      return false;
    }
    await ensureDirectory();
    await fs.writeFile(targetPath, buffer);
    return true;
  } catch (error) {
    recordDownloadFailure(artifactType, `network:${error instanceof Error ? error.name : 'unknown'}`);
    logger.warn({ url: sanitizeForLogging(url), error: sanitizeForLogging(error), artifactType }, 'Failed to download urlscan artifact');
    return false;
  }
}

export async function downloadUrlscanArtifacts(scanId: string, urlHash: string): Promise<ArtifactPaths> {
  const safeScanId = sanitizeFileSegment(scanId);
  const safeHash = sanitizeFileSegment(urlHash);
  const screenshotPath = path.join(ARTIFACT_DIR, `${safeHash}_${safeScanId}.png`);
  const domPath = path.join(ARTIFACT_DIR, `${safeHash}_${safeScanId}.html`);
  const safeBaseUrl = await getSafeUrlscanBase(config.urlscan.baseUrl || 'https://urlscan.io');
  if (!safeBaseUrl) {
    recordDownloadFailure('screenshot', 'urlscan_base_blocked');
    recordDownloadFailure('dom', 'urlscan_base_blocked');
    logger.error({ baseUrl: sanitizeForLogging(config.urlscan.baseUrl) }, 'Unsafe urlscan base URL blocked');
    return {
      screenshotPath: null,
      domPath: null,
    };
  }
  const encodedScanId = encodeURIComponent(scanId);
  const screenshotUrl = `${safeBaseUrl}/screenshots/${encodedScanId}.png`;
  const domUrl = `${safeBaseUrl}/dom/${encodedScanId}/`;

  const screenshotSaved = await downloadToFile('screenshot', screenshotUrl, screenshotPath);
  if (!screenshotSaved) {
    logger.warn({ scanId: sanitizeForLogging(scanId), urlHash: sanitizeForLogging(urlHash) }, 'Screenshot download failed');
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
      if (Buffer.byteLength(html, 'utf8') > MAX_ARTIFACT_BYTES) {
        recordDownloadFailure('dom', 'size_exceeded');
        logger.warn({ scanId: sanitizeForLogging(scanId), urlHash: sanitizeForLogging(urlHash) }, 'DOM artifact exceeded size limit');
        return {
          screenshotPath: screenshotSaved ? screenshotPath : null,
          domPath: null,
        };
      }
      await ensureDirectory();
      await fs.writeFile(domPath, html, 'utf8');
      domSaved = true;
    } else {
      recordDownloadFailure('dom', `http:${response?.status ?? 'unknown'}`);
      logger.warn({ scanId: sanitizeForLogging(scanId), urlHash: sanitizeForLogging(urlHash), status: response?.status }, 'DOM download failed');
    }
  } catch (error) {
    recordDownloadFailure('dom', `network:${error instanceof Error ? error.name : 'unknown'}`);
    logger.warn({ scanId: sanitizeForLogging(scanId), urlHash: sanitizeForLogging(urlHash), error: sanitizeForLogging(error) }, 'Failed to download urlscan DOM');
  }

  return {
    screenshotPath: screenshotSaved ? screenshotPath : null,
    domPath: domSaved ? domPath : null,
  };
}
