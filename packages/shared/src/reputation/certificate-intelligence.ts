import * as tls from 'tls';
import * as https from 'https';
import { logger } from '../log';
import { metrics } from '../metrics';
import { Counter, Histogram } from 'prom-client';

const certAnalysisTotal = new Counter({
  name: 'cert_analysis_total',
  help: 'Total number of certificate analyses performed',
  labelNames: ['result'],
  registers: [metrics],
});

const certSuspiciousTotal = new Counter({
  name: 'cert_suspicious_total',
  help: 'Total number of suspicious certificates detected',
  labelNames: ['reason'],
  registers: [metrics],
});

const certAnalysisLatencySeconds = new Histogram({
  name: 'cert_analysis_latency_seconds',
  help: 'Certificate analysis latency in seconds',
  buckets: [0.5, 1, 2, 3, 5],
  registers: [metrics],
});

interface CertificateAnalysis {
  isValid: boolean;
  isSelfSigned: boolean;
  issuer: string;
  age: number;
  expiryDays: number;
  sanCount: number;
  chainValid: boolean;
  ctLogPresent: boolean;
  suspicionScore: number;
  reasons: string[];
}

const certCache = new Map<string, { result: CertificateAnalysis; expiry: number }>();

function getCached(hostname: string): CertificateAnalysis | null {
  const cached = certCache.get(hostname);
  if (cached && cached.expiry > Date.now()) {
    return cached.result;
  }
  if (cached) {
    certCache.delete(hostname);
  }
  return null;
}

function setCache(hostname: string, result: CertificateAnalysis, ttlMs: number): void {
  certCache.set(hostname, {
    result,
    expiry: Date.now() + ttlMs,
  });
}

async function fetchCertificate(hostname: string, timeoutMs: number): Promise<tls.PeerCertificate | null> {
  return new Promise((resolve) => {
    const options: https.RequestOptions = {
      hostname,
      port: 443,
      method: 'HEAD',
      path: '/',
      timeout: timeoutMs,
      rejectUnauthorized: false,
    };

    const req = https.request(options, (res) => {
      const cert = (res.socket as tls.TLSSocket).getPeerCertificate();
      req.destroy();
      resolve(cert && Object.keys(cert).length > 0 ? cert : null);
    });

    req.on('error', (err) => {
      logger.debug({ hostname, error: err.message }, 'Certificate fetch error');
      resolve(null);
    });

    req.on('timeout', () => {
      req.destroy();
      logger.debug({ hostname, timeoutMs }, 'Certificate fetch timeout');
      resolve(null);
    });

    req.end();
  });
}

async function checkCertificateTransparency(hostname: string, timeoutMs: number): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`https://crt.sh/?q=${encodeURIComponent(hostname)}&output=json`, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'wbscanner-bot/1.0',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return Array.isArray(data) && data.length > 0;
  } catch (err: any) {
    logger.debug({ hostname, error: err.message }, 'CT log check failed');
    return false;
  }
}

function isSelfSigned(cert: tls.PeerCertificate): boolean {
  return cert.issuer && cert.subject && JSON.stringify(cert.issuer) === JSON.stringify(cert.subject);
}

function getCertificateAge(cert: tls.PeerCertificate): number {
  if (!cert.valid_from) {
    return 0;
  }
  const validFrom = new Date(cert.valid_from);
  const now = new Date();
  const ageMs = now.getTime() - validFrom.getTime();
  return Math.floor(ageMs / (1000 * 60 * 60 * 24));
}

function getExpiryDays(cert: tls.PeerCertificate): number {
  if (!cert.valid_to) {
    return 0;
  }
  const validTo = new Date(cert.valid_to);
  const now = new Date();
  const daysMs = validTo.getTime() - now.getTime();
  return Math.floor(daysMs / (1000 * 60 * 60 * 24));
}

function getSANCount(cert: tls.PeerCertificate): number {
  if (!cert.subjectaltname) {
    return 0;
  }
  return cert.subjectaltname.split(',').length;
}

function isChainValid(cert: tls.PeerCertificate): boolean {
  return !cert.issuerCertificate || cert.issuerCertificate !== cert;
}

export async function certificateIntelligence(
  hostname: string,
  config: {
    timeoutMs?: number;
    ctCheckEnabled?: boolean;
  } = {}
): Promise<CertificateAnalysis> {
  const startTime = Date.now();
  const { timeoutMs = 3000, ctCheckEnabled = true } = config;

  const cached = getCached(hostname);
  if (cached) {
    return cached;
  }

  const reasons: string[] = [];
  let suspicionScore = 0;

  try {
    const [cert, ctLogPresent] = await Promise.all([
      fetchCertificate(hostname, timeoutMs),
      ctCheckEnabled ? checkCertificateTransparency(hostname, timeoutMs) : Promise.resolve(true),
    ]);

    if (!cert) {
      const result: CertificateAnalysis = {
        isValid: false,
        isSelfSigned: false,
        issuer: 'unknown',
        age: 0,
        expiryDays: 0,
        sanCount: 0,
        chainValid: false,
        ctLogPresent: false,
        suspicionScore: 0.5,
        reasons: ['Unable to fetch certificate'],
      };

      certAnalysisTotal.labels('error').inc();
      setCache(hostname, result, 60 * 60 * 1000);

      const latency = (Date.now() - startTime) / 1000;
      certAnalysisLatencySeconds.observe(latency);

      return result;
    }

    const selfSigned = isSelfSigned(cert);
    const age = getCertificateAge(cert);
    const expiryDays = getExpiryDays(cert);
    const sanCount = getSANCount(cert);
    const chainValid = isChainValid(cert);
    const issuer = cert.issuer?.O || cert.issuer?.CN || 'unknown';

    if (selfSigned) {
      suspicionScore += 0.8;
      reasons.push('Self-signed certificate');
      certSuspiciousTotal.labels('self_signed').inc();
    }

    if (age < 7) {
      suspicionScore += 0.4;
      reasons.push(`Certificate age < 7 days (${age} days)`);
      certSuspiciousTotal.labels('very_new').inc();
    } else if (age < 30) {
      suspicionScore += 0.2;
      reasons.push(`Certificate age < 30 days (${age} days)`);
      certSuspiciousTotal.labels('new').inc();
    }

    if (sanCount > 10) {
      suspicionScore += 0.3;
      reasons.push(`Excessive SAN count (${sanCount})`);
      certSuspiciousTotal.labels('excessive_san').inc();
    }

    if (!chainValid) {
      suspicionScore += 0.5;
      reasons.push('Invalid certificate chain');
      certSuspiciousTotal.labels('invalid_chain').inc();
    }

    if (!ctLogPresent) {
      suspicionScore += 0.3;
      reasons.push('Not found in Certificate Transparency logs');
      certSuspiciousTotal.labels('no_ct_log').inc();
    }

    if (expiryDays < 0) {
      suspicionScore += 0.9;
      reasons.push('Certificate expired');
      certSuspiciousTotal.labels('expired').inc();
    }

    const result: CertificateAnalysis = {
      isValid: expiryDays >= 0 && !selfSigned,
      isSelfSigned: selfSigned,
      issuer,
      age,
      expiryDays,
      sanCount,
      chainValid,
      ctLogPresent,
      suspicionScore,
      reasons,
    };

    certAnalysisTotal.labels('success').inc();

    const cacheTtl = suspicionScore > 0.5 ? 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
    setCache(hostname, result, cacheTtl);

    const latency = (Date.now() - startTime) / 1000;
    certAnalysisLatencySeconds.observe(latency);

    if (suspicionScore > 0) {
      logger.info({ hostname, suspicionScore, reasons }, 'Suspicious certificate detected');
    }

    return result;
  } catch (err: any) {
    const result: CertificateAnalysis = {
      isValid: false,
      isSelfSigned: false,
      issuer: 'unknown',
      age: 0,
      expiryDays: 0,
      sanCount: 0,
      chainValid: false,
      ctLogPresent: false,
      suspicionScore: 0.3,
      reasons: [`Certificate analysis error: ${err.message}`],
    };

    certAnalysisTotal.labels('error').inc();
    setCache(hostname, result, 60 * 60 * 1000);

    const latency = (Date.now() - startTime) / 1000;
    certAnalysisLatencySeconds.observe(latency);

    logger.warn({ hostname, error: err.message }, 'Certificate intelligence failed');

    return result;
  }
}

export type { CertificateAnalysis };
