import fs from "node:fs";
import path from "node:path";
import { toASCII } from "punycode/";

const LOCAL_FEEDS_ENABLED =
  (process.env.LOCAL_FEEDS_ENABLED || "true") === "true";
const FEED_DIR =
  process.env.LOCAL_FEED_DIR || path.join(process.cwd(), "storage", "feeds");

const OPENPHISH_PATH =
  process.env.OPENPHISH_LOCAL_PATH || path.join(FEED_DIR, "openphish.txt");
const URLHAUS_PATH =
  process.env.URLHAUS_LOCAL_PATH || path.join(FEED_DIR, "urlhaus.txt");
const SANS_PATH =
  process.env.SANS_LOCAL_PATH || path.join(FEED_DIR, "sans-domains.txt");

const SANS_SCORE_MIN = Number.parseInt(process.env.SANS_SCORE_MIN || "3", 10);

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "mc_cid",
  "mc_eid",
  "vero_conv",
  "vero_id",
]);

type FeedCache = {
  path: string;
  mtimeMs: number;
  entries: Set<string>;
};

export type LocalFeedSignals = {
  openphishListed?: boolean;
  urlhausListed?: boolean;
  suspiciousDomainListed?: boolean;
};

let openphishCache: FeedCache | null = null;
let urlhausCache: FeedCache | null = null;
let sansCache: FeedCache | null = null;

function normalizeDomain(input: unknown): string | null {
  if (!input || typeof input !== "string") return null;
  const trimmed = input.trim().toLowerCase();
  if (!trimmed || !trimmed.includes(".")) return null;
  return trimmed.replace(/\.+$/, "");
}

function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (!["http:", "https:"].includes(u.protocol)) return null;
    u.hostname = u.hostname.toLowerCase();
    u.hostname = toASCII(u.hostname);
    if (
      (u.protocol === "http:" && u.port === "80") ||
      (u.protocol === "https:" && u.port === "443")
    ) {
      u.port = "";
    }
    u.hash = "";
    for (const p of Array.from(u.searchParams.keys())) {
      if (TRACKING_PARAMS.has(p)) u.searchParams.delete(p);
    }
    u.pathname = u.pathname.replace(/\/+/g, "/");
    return u.toString();
  } catch {
    return null;
  }
}

function parseUrlFeed(raw: string): Set<string> {
  const set = new Set<string>();
  raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && line.startsWith("http"))
    .forEach((line) => {
      const normalized = normalizeUrl(line);
      if (normalized) set.add(normalized);
    });
  return set;
}

function parseSansDomains(raw: string): Set<string> {
  const trimmed = raw.trim();
  if (!trimmed) return new Set();

  let records: unknown[] = [];
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        records = parsed;
      }
    } catch {
      return new Set();
    }
  } else if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        records = parsed;
      } else if (parsed) {
        records = [parsed];
      }
    } catch {
      return new Set();
    }
  } else {
    for (const line of trimmed.split(/\r?\n/)) {
      const entry = line.trim();
      if (!entry) continue;
      // Accept plain domain lists as-is
      if (!entry.startsWith("{")) {
        const domain = normalizeDomain(entry);
        if (domain) {
          records.push({ domainname: domain, score: SANS_SCORE_MIN });
        }
        continue;
      }
      try {
        records.push(JSON.parse(entry));
      } catch {
        continue;
      }
    }
  }

  const set = new Set<string>();
  for (const record of records) {
    const rawScore =
      (
        record as {
          score?: unknown;
          risk?: unknown;
          risk_score?: unknown;
          r?: unknown;
        }
      )?.score ??
      (record as { risk?: unknown })?.risk ??
      (record as { risk_score?: unknown })?.risk_score ??
      (record as { r?: unknown })?.r;
    const score = Number.isFinite(Number(rawScore)) ? Number(rawScore) : 0;
    if (score < SANS_SCORE_MIN) continue;

    const domain =
      normalizeDomain((record as { domainname?: unknown })?.domainname) ||
      normalizeDomain((record as { domain?: unknown })?.domain) ||
      normalizeDomain((record as { name?: unknown })?.name) ||
      normalizeDomain((record as { fqdn?: unknown })?.fqdn) ||
      normalizeDomain((record as { host?: unknown })?.host);
    if (domain) set.add(domain);
  }

  return set;
}

function loadFeed(
  cache: FeedCache | null,
  filePath: string,
  parser: (raw: string) => Set<string>,
): FeedCache | null {
  try {
    if (!fs.existsSync(filePath)) return cache;
    const stats = fs.statSync(filePath);
    if (cache && cache.mtimeMs === stats.mtimeMs) {
      return cache;
    }
    const raw = fs.readFileSync(filePath, "utf8");
    return { path: filePath, mtimeMs: stats.mtimeMs, entries: parser(raw) };
  } catch {
    return cache;
  }
}

function getOpenphish(): FeedCache | null {
  openphishCache = loadFeed(openphishCache, OPENPHISH_PATH, parseUrlFeed);
  return openphishCache;
}

function getUrlhaus(): FeedCache | null {
  urlhausCache = loadFeed(urlhausCache, URLHAUS_PATH, parseUrlFeed);
  return urlhausCache;
}

function getSans(): FeedCache | null {
  sansCache = loadFeed(sansCache, SANS_PATH, parseSansDomains);
  return sansCache;
}

export function resetLocalFeedCache(): void {
  openphishCache = null;
  urlhausCache = null;
  sansCache = null;
}

export function lookupLocalFeedSignals(finalUrl: string): LocalFeedSignals {
  if (!LOCAL_FEEDS_ENABLED) return {};

  const normalized = normalizeUrl(finalUrl) || finalUrl;
  const hostname = (() => {
    try {
      return new URL(normalized).hostname.toLowerCase();
    } catch {
      return "";
    }
  })();

  const signals: LocalFeedSignals = {};

  const openphish = getOpenphish();
  if (openphish?.entries.has(normalized)) {
    signals.openphishListed = true;
  }

  const urlhaus = getUrlhaus();
  if (urlhaus?.entries.has(normalized)) {
    signals.urlhausListed = true;
  }

  const sans = getSans();
  if (hostname && sans?.entries.has(hostname)) {
    signals.suspiciousDomainListed = true;
  }

  return signals;
}
