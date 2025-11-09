import {
  config,
  logger,
  dnsIntelligence,
  certificateIntelligence,
  advancedHeuristics,
  LocalThreatDatabase,
  httpFingerprinting,
  type DNSIntelligenceResult,
  type CertificateAnalysis,
  type AdvancedHeuristicsResult,
  type LocalThreatResult,
  type HTTPFingerprint,
} from '@wbscanner/shared';
import { Counter, Histogram } from 'prom-client';
import { metrics } from '@wbscanner/shared';
import type Redis from 'ioredis';

const enhancedSecurityScoreHistogram = new Histogram({
  name: 'enhanced_security_score',
  help: 'Enhanced security score distribution',
  buckets: [0.5, 1.0, 1.5, 2.0, 2.5, 3.0],
  registers: [metrics],
});

const tier1BlocksTotal = new Counter({
  name: 'tier1_blocks_total',
  help: 'Total number of scans blocked by Tier 1 checks',
  registers: [metrics],
});

const apiCallsAvoidedTotal = new Counter({
  name: 'api_calls_avoided_total',
  help: 'Total number of external API calls avoided due to enhanced security',
  registers: [metrics],
});

const enhancedSecurityLatencySeconds = new Histogram({
  name: 'enhanced_security_latency_seconds',
  help: 'Enhanced security check latency in seconds',
  labelNames: ['tier'],
  buckets: [0.1, 0.25, 0.5, 1, 2, 5],
  registers: [metrics],
});

export interface EnhancedSecurityResult {
  verdict?: 'malicious' | 'suspicious' | null;
  confidence?: 'high' | 'medium' | 'low';
  skipExternalAPIs: boolean;
  score: number;
  reasons: string[];
  tier1Results?: {
    heuristics: AdvancedHeuristicsResult;
    dnsIntel: DNSIntelligenceResult;
    localThreats: LocalThreatResult;
  };
  tier2Results?: {
    certIntel: CertificateAnalysis;
    httpFingerprint: HTTPFingerprint;
  };
}

export class EnhancedSecurityAnalyzer {
  private localThreatDb: LocalThreatDatabase;

  constructor(redis: Redis) {
    this.localThreatDb = new LocalThreatDatabase(redis, {
      feedUrl: config.enhancedSecurity.localThreatDb.feedUrl,
      updateIntervalMs: config.enhancedSecurity.localThreatDb.updateIntervalMs,
    });
  }

  async start(): Promise<void> {
    if (config.enhancedSecurity.enabled && config.enhancedSecurity.localThreatDb.enabled) {
      await this.localThreatDb.start();
      logger.info('Enhanced security analyzer started');
    }
  }

  async stop(): Promise<void> {
    await this.localThreatDb.stop();
    logger.info('Enhanced security analyzer stopped');
  }

  async analyze(finalUrl: string, hash: string): Promise<EnhancedSecurityResult> {
    if (!config.enhancedSecurity.enabled) {
      return {
        skipExternalAPIs: false,
        score: 0,
        reasons: [],
      };
    }

    const startTime = Date.now();

    try {
      const parsed = new URL(finalUrl);

      const tier1Start = Date.now();
      const [heuristics, dnsIntel, localThreats] = await Promise.allSettled([
        advancedHeuristics(finalUrl),
        config.enhancedSecurity.dnsbl.enabled
          ? dnsIntelligence(parsed.hostname, {
              dnsblEnabled: true,
              dnsblTimeoutMs: config.enhancedSecurity.dnsbl.timeoutMs,
              dnssecEnabled: true,
              fastFluxEnabled: true,
            })
          : Promise.resolve({ score: 0, reasons: [], dnsblResults: [] }),
        config.enhancedSecurity.localThreatDb.enabled
          ? this.localThreatDb.check(finalUrl, hash)
          : Promise.resolve({ score: 0, reasons: [] }),
      ]);

      const tier1Duration = (Date.now() - tier1Start) / 1000;
      enhancedSecurityLatencySeconds.labels('tier1').observe(tier1Duration);

      const heuristicsData =
        heuristics.status === 'fulfilled' ? heuristics.value : { score: 0, reasons: [], entropy: 0, subdomainAnalysis: { count: 0, maxDepth: 0, hasNumericSubdomains: false, suspicionScore: 0 }, suspiciousPatterns: [] };
      const dnsIntelData =
        dnsIntel.status === 'fulfilled' ? dnsIntel.value : { score: 0, reasons: [], dnsblResults: [] };
      const localThreatsData =
        localThreats.status === 'fulfilled' ? localThreats.value : { score: 0, reasons: [] };

      const tier1Score = heuristicsData.score + dnsIntelData.score + localThreatsData.score;
      const tier1Reasons = [
        ...heuristicsData.reasons,
        ...dnsIntelData.reasons,
        ...localThreatsData.reasons,
      ];

      if (tier1Score > 2.0) {
        tier1BlocksTotal.inc();
        apiCallsAvoidedTotal.inc();
        enhancedSecurityScoreHistogram.observe(tier1Score);

        logger.info(
          { url: finalUrl, score: tier1Score, reasons: tier1Reasons },
          'Tier 1 high-confidence threat detected'
        );

        return {
          verdict: 'malicious',
          confidence: 'high',
          skipExternalAPIs: true,
          score: tier1Score,
          reasons: tier1Reasons,
          tier1Results: {
            heuristics: heuristicsData,
            dnsIntel: dnsIntelData,
            localThreats: localThreatsData,
          },
        };
      }

      const tier2Start = Date.now();
      const [certIntel, httpFingerprint] = await Promise.allSettled([
        config.enhancedSecurity.certIntel.enabled && parsed.protocol === 'https:'
          ? certificateIntelligence(parsed.hostname, {
              timeoutMs: config.enhancedSecurity.certIntel.timeoutMs,
              ctCheckEnabled: config.enhancedSecurity.certIntel.ctCheckEnabled,
            })
          : Promise.resolve({
              isValid: true,
              isSelfSigned: false,
              issuer: 'unknown',
              age: 0,
              expiryDays: 0,
              sanCount: 0,
              chainValid: true,
              ctLogPresent: true,
              suspicionScore: 0,
              reasons: [],
            }),
        config.enhancedSecurity.httpFingerprint.enabled
          ? httpFingerprinting(finalUrl, {
              timeoutMs: config.enhancedSecurity.httpFingerprint.timeoutMs,
              enableSSRFGuard: true,
            })
          : Promise.resolve({
              statusCode: 0,
              securityHeaders: {
                hsts: false,
                csp: false,
                xFrameOptions: false,
                xContentTypeOptions: false,
              },
              suspiciousRedirects: false,
              suspicionScore: 0,
              reasons: [],
            }),
      ]);

      const tier2Duration = (Date.now() - tier2Start) / 1000;
      enhancedSecurityLatencySeconds.labels('tier2').observe(tier2Duration);

      const certIntelData =
        certIntel.status === 'fulfilled' ? certIntel.value : {
          isValid: true,
          isSelfSigned: false,
          issuer: 'unknown',
          age: 0,
          expiryDays: 0,
          sanCount: 0,
          chainValid: true,
          ctLogPresent: true,
          suspicionScore: 0,
          reasons: [],
        };
      const httpFingerprintData =
        httpFingerprint.status === 'fulfilled' ? httpFingerprint.value : {
          statusCode: 0,
          securityHeaders: {
            hsts: false,
            csp: false,
            xFrameOptions: false,
            xContentTypeOptions: false,
          },
          suspiciousRedirects: false,
          suspicionScore: 0,
          reasons: [],
        };

      const tier2Score = tier1Score + certIntelData.suspicionScore + httpFingerprintData.suspicionScore;
      const tier2Reasons = [
        ...tier1Reasons,
        ...certIntelData.reasons,
        ...httpFingerprintData.reasons,
      ];

      enhancedSecurityScoreHistogram.observe(tier2Score);

      if (tier2Score > 1.5) {
        logger.info(
          { url: finalUrl, score: tier2Score, reasons: tier2Reasons },
          'Tier 2 suspicious indicators detected'
        );

        return {
          verdict: 'suspicious',
          confidence: 'medium',
          skipExternalAPIs: false,
          score: tier2Score,
          reasons: tier2Reasons,
          tier1Results: {
            heuristics: heuristicsData,
            dnsIntel: dnsIntelData,
            localThreats: localThreatsData,
          },
          tier2Results: {
            certIntel: certIntelData,
            httpFingerprint: httpFingerprintData,
          },
        };
      }

      const totalDuration = (Date.now() - startTime) / 1000;
      logger.debug(
        { url: finalUrl, score: tier2Score, tier1Duration, tier2Duration, totalDuration },
        'Enhanced security analysis completed'
      );

      return {
        skipExternalAPIs: false,
        score: tier2Score,
        reasons: tier2Reasons,
        tier1Results: {
          heuristics: heuristicsData,
          dnsIntel: dnsIntelData,
          localThreats: localThreatsData,
        },
        tier2Results: {
          certIntel: certIntelData,
          httpFingerprint: httpFingerprintData,
        },
      };
    } catch (err: any) {
      logger.error({ error: err.message, url: finalUrl }, 'Enhanced security analysis failed');

      return {
        skipExternalAPIs: false,
        score: 0,
        reasons: [],
      };
    }
  }

  async recordVerdict(
    url: string,
    verdict: 'benign' | 'suspicious' | 'malicious',
    confidence: number
  ): Promise<void> {
    if (config.enhancedSecurity.enabled && config.enhancedSecurity.localThreatDb.enabled) {
      await this.localThreatDb.recordVerdict(url, verdict, confidence);
    }
  }

  async getStats(): Promise<{
    openphishCount: number;
    collaborativeCount: number;
  }> {
    if (config.enhancedSecurity.enabled && config.enhancedSecurity.localThreatDb.enabled) {
      return await this.localThreatDb.getStats();
    }
    return { openphishCount: 0, collaborativeCount: 0 };
  }

  async updateFeeds(): Promise<void> {
    if (config.enhancedSecurity.enabled && config.enhancedSecurity.localThreatDb.enabled) {
      await this.localThreatDb.updateOpenPhishFeed();
      logger.info('Threat feeds updated manually');
    }
  }
}
