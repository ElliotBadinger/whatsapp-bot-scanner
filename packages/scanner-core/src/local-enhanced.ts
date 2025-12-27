import fs from "node:fs";
import path from "node:path";
import {
  advancedHeuristics,
  config,
  connectRedis,
  createRedisConnection,
  LocalThreatDatabase,
  logger,
} from "@wbscanner/shared";

import type {
  AdvancedHeuristicsResult,
  LocalThreatResult,
} from "@wbscanner/shared";

export type LocalEnhancedSecurityResult = {
  verdict?: "malicious" | null;
  confidence?: "high" | "medium" | "low" | null;
  score: number;
  reasons: string[];
  skipExternalAPIs: boolean;
  tier1Results?: {
    heuristics: AdvancedHeuristicsResult;
    localThreats: LocalThreatResult;
  };
};

const DEFAULT_FEED_PATH = path.join(
  process.cwd(),
  "storage",
  "feeds",
  "openphish.txt",
);

let redisClient: ReturnType<typeof createRedisConnection> | null = null;
let localThreatDb: LocalThreatDatabase | null = null;
let localThreatDbReady: Promise<void> | null = null;

function resolveLocalThreatFeedUrl(): string {
  const override = (process.env.LOCAL_THREAT_DB_FEED_PATH || "").trim();
  if (override) return override;
  const openphishOverride = (process.env.OPENPHISH_LOCAL_PATH || "").trim();
  if (openphishOverride) return openphishOverride;
  if (fs.existsSync(DEFAULT_FEED_PATH)) {
    return DEFAULT_FEED_PATH;
  }
  return config.enhancedSecurity.localThreatDb.feedUrl;
}

async function getLocalThreatDb(): Promise<LocalThreatDatabase | null> {
  if (
    !config.enhancedSecurity.enabled ||
    !config.enhancedSecurity.localThreatDb.enabled
  ) {
    return null;
  }
  if (!config.redisUrl) {
    return null;
  }
  if (!redisClient) {
    try {
      redisClient = createRedisConnection();
    } catch (err) {
      logger.warn({ err }, "Failed to create Redis connection");
      return null;
    }
  }
  if (!redisClient) {
    return null;
  }
  if (!localThreatDb) {
    localThreatDb = new LocalThreatDatabase(redisClient, {
      feedUrl: resolveLocalThreatFeedUrl(),
      updateIntervalMs: config.enhancedSecurity.localThreatDb.updateIntervalMs,
      allowRemoteFeeds:
        (process.env.LOCAL_THREAT_DB_ALLOW_REMOTE || "false") === "true",
    });
  }
  if (!localThreatDbReady) {
    localThreatDbReady = (async () => {
      try {
        await connectRedis(redisClient, "scanner-core");
        await localThreatDb?.start();
      } catch (err) {
        logger.warn({ err }, "Local threat DB start failed");
        localThreatDb = null;
        redisClient = null;
        localThreatDbReady = null;
      }
    })();
  }
  if (localThreatDbReady) {
    await localThreatDbReady;
  }
  return localThreatDb;
}

export async function analyzeLocalEnhancedSecurity(
  finalUrl: string,
  urlHash: string,
): Promise<LocalEnhancedSecurityResult> {
  if (!config.enhancedSecurity.enabled) {
    return { score: 0, reasons: [], skipExternalAPIs: false };
  }

  const tier1ScoreThreshold = Number.parseFloat(
    process.env.ENHANCED_SECURITY_TIER1_BLOCK_SCORE || "2.0",
  );

  const [heuristics, localThreats] = await Promise.allSettled([
    advancedHeuristics(finalUrl),
    getLocalThreatDb()
      .then((db) =>
        db
          ? db.check(finalUrl, urlHash)
          : Promise.resolve({ score: 0, reasons: [] } as LocalThreatResult),
      )
      .catch(() => ({ score: 0, reasons: [] } as LocalThreatResult)),
  ]);

  const heuristicsData =
    heuristics.status === "fulfilled"
      ? heuristics.value
      : {
          score: 0,
          reasons: [],
          entropy: 0,
          subdomainAnalysis: {
            count: 0,
            maxDepth: 0,
            hasNumericSubdomains: false,
            suspicionScore: 0,
          },
          suspiciousPatterns: [],
        };
  const localThreatsData =
    localThreats.status === "fulfilled"
      ? localThreats.value
      : { score: 0, reasons: [] };

  const score = heuristicsData.score + localThreatsData.score;
  const reasons = [
    ...heuristicsData.reasons,
    ...localThreatsData.reasons,
  ].filter(Boolean);

  if (score >= tier1ScoreThreshold) {
    return {
      verdict: "malicious",
      confidence: "high",
      score,
      reasons,
      skipExternalAPIs: true,
      tier1Results: {
        heuristics: heuristicsData,
        localThreats: localThreatsData,
      },
    };
  }

  return {
    verdict: null,
    confidence: null,
    score,
    reasons,
    skipExternalAPIs: false,
    tier1Results: {
      heuristics: heuristicsData,
      localThreats: localThreatsData,
    },
  };
}

export async function recordLocalThreatVerdict(
  finalUrl: string,
  verdict: "benign" | "suspicious" | "malicious",
  confidence: number,
): Promise<void> {
  const db = await getLocalThreatDb();
  if (!db) return;
  await db.recordVerdict(finalUrl, verdict, confidence);
}
