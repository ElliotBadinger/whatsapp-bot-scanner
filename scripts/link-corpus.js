const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const { request } = require("undici");
const punycode = require("punycode/");

const DEFAULT_SOURCES = {
  benign:
    process.env.MAJESTIC_FEED_URL ||
    "https://downloads.majestic.com/majestic_million.csv",
  malicious: {
    openphish:
      process.env.OPENPHISH_FEED_URL ||
      "https://raw.githubusercontent.com/openphish/public_feed/refs/heads/main/feed.txt",
    urlhaus:
      process.env.URLHAUS_FEED_URL ||
      "https://urlhaus.abuse.ch/downloads/text_online/",
    certpl:
      process.env.CERTPL_FEED_URL ||
      "https://hole.cert.pl/domains/v2/domains.txt",
    phishtank:
      process.env.PHISHTANK_FEED_URL ||
      (process.env.PHISHTANK_API_KEY
        ? `http://data.phishtank.com/data/${process.env.PHISHTANK_API_KEY}/online-valid.json`
        : ""),
  },
  suspicious:
    process.env.SANS_DOMAIN_FEED_URL ||
    "https://isc.sans.edu/feeds/domaindata.json.gz",
};

const DEFAULT_LIMITS = {
  benign: 500,
  malicious: 500,
  suspicious: 300,
  tricky: 200,
};

const TRICKY_PATHS = [
  "/login",
  "/signin",
  "/secure",
  "/download.exe",
  "/update",
];

const HOMOGLYPH_MAP = {
  a: "\u0430", // Cyrillic a
  e: "\u0435", // Cyrillic e
  o: "\u043e", // Cyrillic o
  i: "\u0456", // Cyrillic i
  l: "\u04cf", // Cyrillic el
};

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

function parseIntOr(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeUrl(input) {
  try {
    const url = new URL(input.trim());
    if (!url.protocol || !["http:", "https:"].includes(url.protocol)) {
      return null;
    }
    url.hostname = url.hostname.toLowerCase();
    url.hash = "";
    return url.toString();
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

async function fetchText(url) {
  const response = await request(url, {
    method: "GET",
    headersTimeout: 20000,
    bodyTimeout: 20000,
  });

  if (response.statusCode >= 400) {
    throw new Error(`Feed fetch failed: ${url} (${response.statusCode})`);
  }

  const buffer = Buffer.from(await response.body.arrayBuffer());
  const encodingHeader = response.headers["content-encoding"];
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

function parseUrlList(data, limit) {
  const urls = [];
  const lines = data.split(/\r?\n/);
  for (const line of lines) {
    if (urls.length >= limit) break;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const normalized = normalizeUrl(trimmed);
    if (normalized) urls.push(normalized);
  }
  return urls;
}

function parseDomainList(data, limit) {
  const domains = [];
  const lines = data.split(/\r?\n/);
  for (const line of lines) {
    if (domains.length >= limit) break;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const domain = normalizeDomain(trimmed);
    if (domain) domains.push(domain);
  }
  return domains;
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

function parsePhishtank(data, limit) {
  const trimmed = data.trim();
  if (!trimmed) return [];

  const urls = [];

  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        for (const entry of parsed) {
          if (urls.length >= limit) break;
          const url = entry?.url || entry?.phish_url;
          const normalized = url ? normalizeUrl(String(url)) : null;
          if (normalized) urls.push(normalized);
        }
        return urls;
      }
    } catch {
      return [];
    }
  }

  for (const line of trimmed.split(/\r?\n/)) {
    if (urls.length >= limit) break;
    const match = line.match(/https?:\/\/[^,\s]+/i);
    if (!match) continue;
    const normalized = normalizeUrl(match[0].replace(/^\"|\"$/g, ""));
    if (normalized) urls.push(normalized);
  }

  return urls;
}

function parseSansDomainData(data, scoreMin, limit) {
  const trimmed = data.trim();
  if (!trimmed) return [];

  let records = [];
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        records = parsed;
      }
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

  const domains = [];
  for (const record of records) {
    if (domains.length >= limit) break;
    const rawScore =
      record?.score ?? record?.risk ?? record?.risk_score ?? record?.r;
    const score = Number.isFinite(Number(rawScore)) ? Number(rawScore) : 0;
    if (score < scoreMin) continue;
    const domain =
      normalizeDomain(record?.domainname) ||
      normalizeDomain(record?.domain) ||
      normalizeDomain(record?.name) ||
      normalizeDomain(record?.fqdn) ||
      normalizeDomain(record?.host);
    if (domain) domains.push(domain);
  }

  return domains;
}

function domainsToUrls(domains, scheme = "https") {
  return domains.map((domain) => `${scheme}://${domain}`);
}

function extractHostname(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function makeTypoDomain(domain) {
  const parts = domain.split(".");
  if (parts[0].length < 4) return null;
  const label = parts[0];
  const typo = label.slice(0, 2) + label.slice(3);
  return [typo, ...parts.slice(1)].join(".");
}

function makeSwapDomain(domain) {
  const parts = domain.split(".");
  const label = parts[0];
  if (label.length < 2) return null;
  const swapped = label[1] + label[0] + label.slice(2);
  return [swapped, ...parts.slice(1)].join(".");
}

function makeHyphenDomain(domain) {
  const parts = domain.split(".");
  const label = parts[0];
  if (label.length < 3) return null;
  const hyphenated = `${label.slice(0, 3)}-${label.slice(3)}`;
  return [hyphenated, ...parts.slice(1)].join(".");
}

function makeHomoglyphDomain(domain) {
  const parts = domain.split(".");
  const label = parts[0];
  let replaced = null;
  for (let i = 0; i < label.length; i += 1) {
    const char = label[i];
    if (HOMOGLYPH_MAP[char]) {
      replaced = label.slice(0, i) + HOMOGLYPH_MAP[char] + label.slice(i + 1);
      break;
    }
  }
  if (!replaced) return null;
  const unicodeDomain = [replaced, ...parts.slice(1)].join(".");
  return punycode.toASCII(unicodeDomain);
}

function generateTrickyUrls(domains, maliciousUrls, limit) {
  const results = [];
  const maliciousHosts = maliciousUrls
    .map(extractHostname)
    .filter((host) => host);

  const add = (url) => {
    if (!url || results.length >= limit) return;
    results.push(url);
  };

  for (const domain of domains) {
    if (results.length >= limit) break;

    const typo = makeTypoDomain(domain);
    if (typo) add(`https://${typo}${TRICKY_PATHS[0]}`);

    const swapped = makeSwapDomain(domain);
    if (swapped) add(`https://${swapped}${TRICKY_PATHS[1]}`);

    const hyphenated = makeHyphenDomain(domain);
    if (hyphenated) add(`https://${hyphenated}${TRICKY_PATHS[2]}`);

    const homoglyph = makeHomoglyphDomain(domain);
    if (homoglyph) add(`https://${homoglyph}${TRICKY_PATHS[3]}`);

    const maliciousHost =
      maliciousHosts[results.length % maliciousHosts.length];
    if (maliciousHost) {
      add(`https://${domain}@${maliciousHost}${TRICKY_PATHS[4]}`);
    }
  }

  return results.slice(0, limit);
}

function interleaveSources(sources, limit) {
  const cursors = sources.map(() => 0);
  const results = [];
  while (results.length < limit) {
    let added = false;
    for (let i = 0; i < sources.length; i += 1) {
      const source = sources[i];
      const cursor = cursors[i] ?? 0;
      if (cursor < source.length) {
        results.push(source[cursor]);
        cursors[i] = cursor + 1;
        added = true;
        if (results.length >= limit) break;
      }
    }
    if (!added) break;
  }
  return results;
}

function interleaveEntries(groups, limit) {
  const cursors = groups.map(() => 0);
  const results = [];
  while (results.length < limit) {
    let added = false;
    for (let i = 0; i < groups.length; i += 1) {
      const group = groups[i];
      const cursor = cursors[i] ?? 0;
      if (cursor < group.length) {
        results.push(group[cursor]);
        cursors[i] = cursor + 1;
        added = true;
        if (results.length >= limit) break;
      }
    }
    if (!added) break;
  }
  return results;
}

function dedupeEntries(entries) {
  const priority = {
    malicious: 3,
    suspicious: 2,
    tricky: 1,
    benign: 0,
  };

  const byUrl = new Map();
  for (const entry of entries) {
    const existing = byUrl.get(entry.url);
    if (!existing) {
      byUrl.set(entry.url, entry);
      continue;
    }
    if (priority[entry.label] > priority[existing.label]) {
      byUrl.set(entry.url, entry);
    }
  }
  return Array.from(byUrl.values());
}

async function buildCorpus(options) {
  const fetchedAt = new Date().toISOString();
  const maliciousLimit = options.maliciousLimit;
  const openphishLimit = Math.ceil(maliciousLimit * 0.5);
  const urlhausLimit = maliciousLimit - openphishLimit;

  const [
    majesticRaw,
    openphishRaw,
    urlhausRaw,
    sansRaw,
    certplRaw,
    phishtankRaw,
  ] = await Promise.all([
    fetchText(options.sources.benign),
    fetchText(options.sources.malicious.openphish),
    fetchText(options.sources.malicious.urlhaus),
    fetchText(options.sources.suspicious),
    fetchText(options.sources.malicious.certpl),
    fetchOptional(options.sources.malicious.phishtank),
  ]);

  const benignDomains = parseMajesticCsv(majesticRaw, options.benignLimit);
  const benignUrls = domainsToUrls(benignDomains);

  const openphishUrls = parseUrlList(openphishRaw, openphishLimit);
  const urlhausUrls = parseUrlList(urlhausRaw, urlhausLimit);
  const certplDomains = parseDomainList(certplRaw, maliciousLimit);
  const certplUrls = domainsToUrls(certplDomains);
  const phishtankUrls = parsePhishtank(phishtankRaw, maliciousLimit);

  const suspiciousDomains = parseSansDomainData(
    sansRaw,
    options.suspiciousScoreMin,
    options.suspiciousLimit,
  );
  const suspiciousUrls = domainsToUrls(suspiciousDomains);

  const maliciousSources = [
    openphishUrls,
    urlhausUrls,
    phishtankUrls,
    certplUrls,
  ];
  const maliciousUrls = interleaveSources(maliciousSources, maliciousLimit);
  const trickySeeds = [...openphishUrls, ...urlhausUrls, ...phishtankUrls];
  const trickyUrls = generateTrickyUrls(
    benignDomains,
    trickySeeds,
    options.trickyLimit,
  );

  const entries = [
    ...interleaveEntries(
      [
        openphishUrls.map((url) => ({
          url,
          label: "malicious",
          source: "openphish",
          fetchedAt,
        })),
        urlhausUrls.map((url) => ({
          url,
          label: "malicious",
          source: "urlhaus",
          fetchedAt,
        })),
        phishtankUrls.map((url) => ({
          url,
          label: "malicious",
          source: "phishtank",
          fetchedAt,
        })),
        certplUrls.map((url) => ({
          url,
          label: "malicious",
          source: "certpl",
          fetchedAt,
        })),
      ],
      maliciousLimit,
    ),
    ...suspiciousUrls.map((url) => ({
      url,
      label: "suspicious",
      source: "sans-isc-domaindata",
      fetchedAt,
    })),
    ...trickyUrls.map((url) => ({
      url,
      label: "tricky",
      source: "synthetic",
      fetchedAt,
    })),
    ...benignUrls.map((url) => ({
      url,
      label: "benign",
      source: "majestic-million",
      fetchedAt,
    })),
  ];

  const deduped = dedupeEntries(entries);

  const stats = deduped.reduce(
    (acc, entry) => {
      acc.total += 1;
      acc[entry.label] = (acc[entry.label] ?? 0) + 1;
      return acc;
    },
    { total: 0, benign: 0, suspicious: 0, malicious: 0, tricky: 0 },
  );

  return { entries: deduped, stats };
}

function writeJsonLines(filePath, entries) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const lines = entries.map((entry) => JSON.stringify(entry));
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
}

async function enqueueEntries(entries, options) {
  const { Queue } = require("bullmq");
  if (!options.redisUrl) {
    throw new Error("REDIS_URL is required to enqueue scan jobs");
  }
  const queue = new Queue(options.queueName, {
    connection: { url: options.redisUrl },
  });

  const now = Date.now();
  const jobs = entries.map((entry, index) => ({
    name: "scan",
    data: {
      url: entry.url,
      chatId: options.chatId,
      messageId: `${options.messagePrefix}-${index}`,
      timestamp: now,
    },
    opts: {
      removeOnComplete: true,
      removeOnFail: true,
    },
  }));

  if (options.enqueueRate <= 0) {
    await queue.addBulk(jobs);
  } else {
    for (const job of jobs) {
      await queue.add(job.name, job.data, job.opts);
      await new Promise((resolve) =>
        setTimeout(resolve, Math.round(1000 / options.enqueueRate)),
      );
    }
  }

  await queue.close();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const options = {
    sources: DEFAULT_SOURCES,
    out: args.out || "storage/link-corpus.jsonl",
    summary: args.summary || "storage/link-corpus.summary.json",
    benignLimit: parseIntOr(args["benign-limit"], DEFAULT_LIMITS.benign),
    maliciousLimit: parseIntOr(
      args["malicious-limit"],
      DEFAULT_LIMITS.malicious,
    ),
    suspiciousLimit: parseIntOr(
      args["suspicious-limit"],
      DEFAULT_LIMITS.suspicious,
    ),
    trickyLimit: parseIntOr(args["tricky-limit"], DEFAULT_LIMITS.tricky),
    suspiciousScoreMin: parseIntOr(args["suspicious-score-min"], 7),
    enqueue: Boolean(args.enqueue),
    enqueueRate: parseIntOr(args["enqueue-rate"], 0),
    queueName: args.queue || process.env.SCAN_REQUEST_QUEUE || "scan-request",
    redisUrl: args.redis || process.env.REDIS_URL || "",
    chatId: args["chat-id"] || "corpus",
    messagePrefix: args["message-prefix"] || "corpus",
    dryRun: Boolean(args["dry-run"]),
  };

  const { entries, stats } = await buildCorpus(options);

  if (!options.dryRun) {
    writeJsonLines(options.out, entries);
    fs.writeFileSync(options.summary, JSON.stringify(stats, null, 2), "utf8");
  }

  console.log(
    JSON.stringify(
      {
        output: options.out,
        summary: options.summary,
        stats,
        enqueue: options.enqueue,
      },
      null,
      2,
    ),
  );

  if (options.enqueue) {
    await enqueueEntries(entries, options);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}

module.exports = {
  parseArgs,
  parseUrlList,
  parseMajesticCsv,
  parseSansDomainData,
  generateTrickyUrls,
  dedupeEntries,
  buildCorpus,
  normalizeUrl,
  normalizeDomain,
};
