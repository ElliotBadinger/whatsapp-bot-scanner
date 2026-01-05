import { readFile } from 'node:fs/promises';
import { ensureCachedText, storagePath } from './cache';

export type DatasetLabel = 'benign' | 'suspicious' | 'malicious';

export interface LabeledUrl {
  url: string;
  label: DatasetLabel;
  source: string;
  tags?: string[];
}

function normalizeUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).toString();
  } catch {
    return null;
  }
}

export async function fetchOpenPhishMalicious(limit: number): Promise<LabeledUrl[]> {
  const text = await ensureCachedText(
    'https://openphish.com/feed.txt',
    storagePath('openphish/feed.txt'),
    { maxAgeMs: 60 * 60 * 1000 }
  );
  const urls = text
    .split('\n')
    .map((line) => normalizeUrl(line))
    .filter((u): u is string => Boolean(u))
    .slice(0, limit);
  return urls.map((url) => ({ url, label: 'malicious', source: 'openphish', tags: ['phishing'] }));
}

export async function fetchUrlhausMalicious(limit: number): Promise<LabeledUrl[]> {
  const text = await ensureCachedText(
    'https://urlhaus.abuse.ch/downloads/text_recent/',
    storagePath('urlhaus/text_recent.txt'),
    { maxAgeMs: 30 * 60 * 1000 }
  );
  const urls = text
    .split('\n')
    .map((line) => normalizeUrl(line))
    .filter((u): u is string => Boolean(u))
    .slice(0, limit);
  return urls.map((url) => ({ url, label: 'malicious', source: 'urlhaus', tags: ['malware'] }));
}

export async function fetchMajesticBenign(limit: number): Promise<LabeledUrl[]> {
  // Avoid downloading the full 76MB by fetching the first ~5MB; enough for >100k rows.
  const text = await ensureCachedText(
    'https://downloads.majestic.com/majestic_million.csv',
    storagePath('majestic/majestic_million.head.csv'),
    {
      maxAgeMs: 7 * 24 * 60 * 60 * 1000,
      headers: { Range: 'bytes=0-5000000' },
    }
  );

  const lines = text.split('\n').slice(1); // header
  const urls: string[] = [];
  for (const line of lines) {
    const parts = line.split(',');
    const domain = (parts[2] ?? '').trim();
    if (!domain) continue;
    const normalized = normalizeUrl(`https://${domain}/`);
    if (normalized) urls.push(normalized);
    if (urls.length >= limit) break;
  }

  return urls.map((u) => ({ url: u, label: 'benign', source: 'majestic-million', tags: ['benign'] }));
}

export async function buildHardModeSuspiciousFromReport(
  reportPath: string,
  limit: number
): Promise<LabeledUrl[]> {
  const text = await readFile(reportPath, 'utf8');

  const codeTicks = Array.from(text.matchAll(/`([^`]+)`/g)).map((m) => m[1]);
  const candidates = new Set<string>();

  for (const raw of codeTicks) {
    const sanitized = desanitizeThreatPattern(raw);
    if (!sanitized) continue;
    const normalized = normalizeUrl(sanitized);
    if (!normalized) continue;
    if (!isHighSignalHardMode(normalized)) continue;
    candidates.add(normalized);
    if (candidates.size >= limit) break;
  }

  return Array.from(candidates).slice(0, limit).map((url) => ({
    url,
    label: 'suspicious',
    source: 'hard-mode-report',
    tags: ['hard-mode', 'heuristics'],
  }));
}

function desanitizeThreatPattern(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;

  s = s
    .replace(/^hxxps:\/\//i, 'https://')
    .replace(/^hxxp:\/\//i, 'http://')
    .replace(/\s+/g, '')
    .replace(/\(\.\)/g, '.')
    .replace(/\[\. ?\]/g, '.')
    .replace(/\[dot\]/gi, '.')
    .replace(/\[[a-zA-Z_]{2,}\]/g, 'test');

  if (!/^https?:\/\//i.test(s)) {
    s = `https://${s}`;
  }

  return s;
}

function isHighSignalHardMode(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes('urldefense.proofpoint.com/v2/url?') ||
    lower.includes('.safelinks.protection.outlook.com') ||
    lower.includes('l.facebook.com/l.php?') ||
    lower.includes('www.google.com/url?') ||
    lower.includes('business.google.com/website_shared/launch_bw.html?') ||
    lower.includes('af_web_dp=') ||
    lower.includes('$fallback_url=') ||
    lower.includes('ofl=') ||
    lower.includes('/cgi-bin/res') ||
    lower.includes('/verify-human/') ||
    lower.includes('/how-to-fix/') ||
    (lower.includes('.php?') && lower.includes('http')) ||
    /https?:\/\/\d{1,3}(?:\.\d{1,3}){3}:\d{2,5}\//.test(lower)
  );
}
