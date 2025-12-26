const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const { request } = require("undici");
const { toASCII } = require("punycode/");

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

const DEFAULT_URLS = {
  majestic:
    process.env.MAJESTIC_FEED_URL ||
    "https://downloads.majestic.com/majestic_million.csv",
  certpl:
    process.env.CERTPL_FEED_URL ||
    "https://hole.cert.pl/domains/v2/domains.txt",
  openphish:
    process.env.OPENPHISH_FEED_URL ||
    "https://raw.githubusercontent.com/openphish/public_feed/refs/heads/main/feed.txt",
  urlhaus:
    process.env.URLHAUS_FEED_URL ||
    "https://urlhaus.abuse.ch/downloads/text_online/",
  sans:
    process.env.SANS_DOMAIN_FEED_URL ||
    "https://isc.sans.edu/feeds/domaindata.json.gz",
};

const FEED_DIR =
  process.env.LOCAL_FEED_DIR || path.join(process.cwd(), "storage", "feeds");
const SANS_SCORE_MIN = Number.parseInt(process.env.SANS_SCORE_MIN || "3", 10);
const MAJESTIC_TOP_LIMIT = Number.parseInt(
  process.env.MAJESTIC_TOP_LIMIT || "10000",
  10,
);
const PHISHTANK_API_KEY = process.env.PHISHTANK_API_KEY || "";
const PHISHTANK_FEED_URL = process.env.PHISHTANK_FEED_URL || "";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function normalizeUrl(raw) {
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

function normalizeDomain(input) {
  if (!input || typeof input !== "string") return null;
  const trimmed = input.trim().toLowerCase();
  if (!trimmed || !trimmed.includes(".")) return null;
  return trimmed.replace(/\.+$/, "");
}

function resolvePhishtankUrl() {
  if (PHISHTANK_FEED_URL) return PHISHTANK_FEED_URL;
  if (PHISHTANK_API_KEY) {
    return `http://data.phishtank.com/data/${PHISHTANK_API_KEY}/online-valid.json`;
  }
  return null;
}

async function fetchText(url) {
  const res = await request(url, {
    method: "GET",
    headersTimeout: 20000,
    bodyTimeout: 30000,
  });

  if (res.statusCode >= 400) {
    throw new Error(`Feed fetch failed: ${url} (${res.statusCode})`);
  }

  const buffer = Buffer.from(await res.body.arrayBuffer());
  const encodingHeader = res.headers["content-encoding"];
  const isGzip =
    (typeof encodingHeader === "string" && encodingHeader.includes("gzip")) ||
    url.endsWith(".gz");

  const decoded = isGzip ? zlib.gunzipSync(buffer) : buffer;
  return decoded.toString("utf8");
}

async function fetchOptional(url) {
  if (!url) return "";
  try {
    return await fetchText(url);
  } catch {
    return "";
  }
}

function parseUrlList(data) {
  const set = new Set();
  data
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && line.startsWith("http"))
    .forEach((line) => {
      const normalized = normalizeUrl(line);
      if (normalized) set.add(normalized);
    });
  return Array.from(set);
}

function parseSansDomains(data) {
  const trimmed = data.trim();
  if (!trimmed) return [];

  let records = [];
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) records = parsed;
    } catch {
      return [];
    }
  } else {
    for (const line of trimmed.split(/\r?\n/)) {
      const entry = line.trim();
      if (!entry) continue;
      try {
        records.push(JSON.parse(entry));
      } catch {
        continue;
      }
    }
  }

  const domains = new Set();
  for (const record of records) {
    const rawScore =
      record?.score ?? record?.risk ?? record?.risk_score ?? record?.r;
    const score = Number.isFinite(Number(rawScore)) ? Number(rawScore) : 0;
    if (score < SANS_SCORE_MIN) continue;

    const domain =
      normalizeDomain(record?.domainname) ||
      normalizeDomain(record?.domain) ||
      normalizeDomain(record?.name) ||
      normalizeDomain(record?.fqdn) ||
      normalizeDomain(record?.host);

    if (domain) domains.add(domain);
  }

  return Array.from(domains);
}

function parseDomainList(data) {
  const domains = new Set();
  data
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const domain = normalizeDomain(line);
      if (domain) domains.add(domain);
    });
  return Array.from(domains);
}

function parsePhishtank(data) {
  const trimmed = data.trim();
  if (!trimmed) return [];

  const urls = new Set();

  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        for (const entry of parsed) {
          const url = entry?.url || entry?.phish_url;
          const normalized = url ? normalizeUrl(String(url)) : null;
          if (normalized) urls.add(normalized);
        }
        return Array.from(urls);
      }
    } catch {
      return [];
    }
  }

  for (const line of trimmed.split(/\r?\n/)) {
    const match = line.match(/https?:\/\/[^,\s]+/i);
    if (!match) continue;
    const normalized = normalizeUrl(match[0].replace(/^\"|\"$/g, ""));
    if (normalized) urls.add(normalized);
  }

  return Array.from(urls);
}

function parseMajesticCsv(data, limit) {
  const lines = data.split(/\r?\n/).filter(Boolean);
  const domains = [];
  const startIndex = lines[0]?.toLowerCase().includes("globalrank") ? 1 : 0;
  for (let i = startIndex; i < lines.length; i += 1) {
    if (domains.length >= limit) break;
    const parts = lines[i].split(",");
    const domain = parts[2] ? normalizeDomain(parts[2]) : null;
    if (domain) domains.push(domain);
  }
  return domains;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outDir = args["out-dir"] || FEED_DIR;
  const dryRun = Boolean(args["dry-run"]);

  const phishtankUrl = resolvePhishtankUrl();
  const [
    majesticRaw,
    openphishRaw,
    urlhausRaw,
    sansRaw,
    certplRaw,
    phishtankRaw,
  ] = await Promise.all([
    fetchText(DEFAULT_URLS.majestic),
    fetchText(DEFAULT_URLS.openphish),
    fetchText(DEFAULT_URLS.urlhaus),
    fetchText(DEFAULT_URLS.sans),
    fetchText(DEFAULT_URLS.certpl),
    fetchOptional(phishtankUrl),
  ]);

  const majesticDomains = parseMajesticCsv(majesticRaw, MAJESTIC_TOP_LIMIT);
  const openphishUrls = parseUrlList(openphishRaw);
  const urlhausUrls = parseUrlList(urlhausRaw);
  const sansDomains = parseSansDomains(sansRaw);
  const certplDomains = parseDomainList(certplRaw);
  const phishtankUrls = parsePhishtank(phishtankRaw);

  const summary = {
    fetchedAt: new Date().toISOString(),
    majestic: { count: majesticDomains.length, source: DEFAULT_URLS.majestic },
    certpl: { count: certplDomains.length, source: DEFAULT_URLS.certpl },
    openphish: { count: openphishUrls.length, source: DEFAULT_URLS.openphish },
    urlhaus: { count: urlhausUrls.length, source: DEFAULT_URLS.urlhaus },
    sans: { count: sansDomains.length, source: DEFAULT_URLS.sans },
    phishtank: phishtankUrl
      ? { count: phishtankUrls.length, source: phishtankUrl }
      : { count: 0, source: null },
    outputDir: outDir,
  };

  if (!dryRun) {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(
      path.join(outDir, "openphish.txt"),
      `${openphishUrls.join("\n")}\n`,
      "utf8",
    );
    fs.writeFileSync(
      path.join(outDir, "certpl-domains.txt"),
      `${certplDomains.join("\n")}\n`,
      "utf8",
    );
    if (phishtankUrls.length > 0) {
      fs.writeFileSync(
        path.join(outDir, "phishtank.txt"),
        `${phishtankUrls.join("\n")}\n`,
        "utf8",
      );
    }
    fs.writeFileSync(
      path.join(outDir, "majestic-top-domains.txt"),
      `${majesticDomains.join("\n")}\n`,
      "utf8",
    );
    fs.writeFileSync(
      path.join(outDir, "urlhaus.txt"),
      `${urlhausUrls.join("\n")}\n`,
      "utf8",
    );
    fs.writeFileSync(
      path.join(outDir, "sans-domains.txt"),
      `${sansDomains.join("\n")}\n`,
      "utf8",
    );
    fs.writeFileSync(
      path.join(outDir, "summary.json"),
      JSON.stringify(summary, null, 2),
      "utf8",
    );
  }

  console.log(JSON.stringify(summary, null, 2));
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
