import { logger } from "../log";
import dns from "dns/promises";

export interface DNSBLResult {
  provider: string;
  listed: boolean;
  reason?: string;
}

export interface DNSIntelligenceResult {
  score: number;
  reasons: string[];
  dnsblResults: DNSBLResult[];
  dnssecValid?: boolean;
  fastFluxDetected?: boolean;
}

interface DNSIntelligenceOptions {
  dnsblEnabled?: boolean;
  dnsblTimeoutMs?: number;
  dnssecEnabled?: boolean;
  fastFluxEnabled?: boolean;
}

const DNSBL_PROVIDERS = [
  "zen.spamhaus.org",
  "bl.spamcop.net",
  "dnsbl.sorbs.net",
];

export async function dnsIntelligence(
  hostname: string,
  options: DNSIntelligenceOptions = {},
): Promise<DNSIntelligenceResult> {
  const {
    dnsblEnabled = true,
    dnsblTimeoutMs = 2000,
    dnssecEnabled = true,
    fastFluxEnabled = true,
  } = options;

  const result: DNSIntelligenceResult = {
    score: 0,
    reasons: [],
    dnsblResults: [],
  };

  try {
    // DNSBL checks
    if (dnsblEnabled) {
      const dnsblResults = await Promise.allSettled(
        DNSBL_PROVIDERS.map((provider) =>
          checkDNSBL(hostname, provider, dnsblTimeoutMs),
        ),
      );

      for (const dnsblResult of dnsblResults) {
        if (dnsblResult.status === "fulfilled" && dnsblResult.value.listed) {
          result.dnsblResults.push(dnsblResult.value);
          result.score += 1.0;
          result.reasons.push(
            `Domain listed in DNSBL: ${dnsblResult.value.provider}`,
          );
        }
      }
    }

    // DNSSEC validation (simplified check)
    if (dnssecEnabled) {
      try {
        const dnssecValid = await checkDNSSEC(hostname);
        result.dnssecValid = dnssecValid;
        if (!dnssecValid) {
          result.score += 0.3;
          result.reasons.push("DNSSEC validation failed");
        }
      } catch (err) {
        logger.debug({ hostname, err }, "DNSSEC check failed");
      }
    }

    // Fast-flux detection (simplified)
    if (fastFluxEnabled) {
      try {
        const fastFlux = await detectFastFlux(hostname);
        result.fastFluxDetected = fastFlux;
        if (fastFlux) {
          result.score += 0.8;
          result.reasons.push("Fast-flux DNS pattern detected");
        }
      } catch (err) {
        logger.debug({ hostname, err }, "Fast-flux detection failed");
      }
    }

    return result;
  } catch (err) {
    logger.warn({ hostname, err }, "DNS intelligence check failed");
    return result;
  }
}

async function checkDNSBL(
  hostname: string,
  provider: string,
  timeoutMs: number,
): Promise<DNSBLResult> {
  try {
    // This is a simplified DNSBL check - in production you'd use proper DNS queries
    const query = `${hostname}.${provider}`;

    // Use Promise.race for timeout
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      setTimeout(() => reject(new Error("DNS timeout")), timeoutMs);
    });

    try {
      await Promise.race([dns.resolve4(query), timeoutPromise]);
      return { provider, listed: true, reason: "Listed in DNSBL" };
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      if (error.code === "ENOTFOUND" || error.code === "ENODATA") {
        return { provider, listed: false };
      }
      if (error.message === "DNS timeout") {
        // Treat timeout as not listed for this specific check
        return {
          provider,
          listed: false,
          reason: "Timeout during DNSBL check",
        };
      }
      throw err;
    }
  } catch (_err) {
    return { provider, listed: false };
  }
}

async function checkDNSSEC(hostname: string): Promise<boolean> {
  try {
    // Simplified DNSSEC check - in production you'd use proper DNSSEC validation
    await dns.resolveTxt(hostname);
    // This is a placeholder - real DNSSEC validation is more complex
    return true;
  } catch (_err) {
    return false;
  }
}

async function detectFastFlux(hostname: string): Promise<boolean> {
  try {
    // Check for multiple A records with short TTL (fast-flux indicator)
    const records = await dns.resolve4(hostname, { ttl: true });

    if (Array.isArray(records) && records.length > 5) {
      // Check if TTL is suspiciously short (< 300 seconds)
      const shortTtl = records.some((record: unknown) => {
        const r = record as { ttl?: number };
        return r.ttl && r.ttl < 300;
      });
      if (shortTtl) {
        return true;
      }
    }

    return false;
  } catch (_err) {
    return false;
  }
}
