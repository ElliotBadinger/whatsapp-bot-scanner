import { request } from 'undici';
import { logger } from '../log';
import tls from 'tls';

export interface CertificateAnalysis {
  isValid: boolean;
  isSelfSigned: boolean;
  issuer: string;
  age: number; // days since issued
  expiryDays: number; // days until expiry
  sanCount: number; // Subject Alternative Names count
  chainValid: boolean;
  ctLogPresent: boolean; // Certificate Transparency log presence
  suspicionScore: number;
  reasons: string[];
}

interface CertificateIntelligenceOptions {
  timeoutMs?: number;
  ctCheckEnabled?: boolean;
}

export async function certificateIntelligence(
  hostname: string,
  options: CertificateIntelligenceOptions = {}
): Promise<CertificateAnalysis> {
  const { timeoutMs = 3000, ctCheckEnabled = true } = options;

  const result: CertificateAnalysis = {
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

  try {
    // First attempt with certificate validation enabled for security
    let certInfo: unknown;
    let isValidCert = true;
    
    try {
      certInfo = await new Promise<unknown>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Certificate check timeout'));
        }, timeoutMs);

        const socket = tls.connect(443, hostname, {
          servername: hostname,
          rejectUnauthorized: true, // Secure by default
        }, () => {
          clearTimeout(timeout);
          const cert = socket.getPeerCertificate(true);
          socket.destroy();
          resolve(cert);
        });

        socket.on('error', (err: Error) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
    } catch (validCertError) {
      // If validation fails, try again without validation to analyze the invalid cert
      logger.debug({ hostname, err: validCertError }, 'Certificate validation failed, attempting to analyze invalid certificate');
      isValidCert = false;
      
      certInfo = await new Promise<unknown>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Certificate check timeout'));
        }, timeoutMs);

        const socket = tls.connect(443, hostname, {
          servername: hostname,
          rejectUnauthorized: false, // Only bypass validation to analyze invalid certs
        }, () => {
          clearTimeout(timeout);
          const cert = socket.getPeerCertificate(true);
          socket.destroy();
          resolve(cert);
        });

        socket.on('error', (err: Error) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
    }

    // Type definition for certificate info
    const cert = certInfo as {
      issuer?: { CN?: string };
      subject?: { CN?: string };
      valid_from?: string;
      valid_to?: string;
      subjectaltname?: string;
    };

    if (cert) {
      // Analyze certificate properties
      result.issuer = cert.issuer?.CN || 'unknown';
      result.isSelfSigned = cert.issuer?.CN === cert.subject?.CN;

      // Calculate certificate age
      if (cert.valid_from) {
        const issuedDate = new Date(cert.valid_from);
        result.age = Math.floor((Date.now() - issuedDate.getTime()) / (1000 * 60 * 60 * 24));
      }

      // Calculate days until expiry
      if (cert.valid_to) {
        const expiryDate = new Date(cert.valid_to);
        result.expiryDays = Math.floor((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      }

      // Count Subject Alternative Names
      if (cert.subjectaltname) {
        result.sanCount = cert.subjectaltname.split(',').length;
      }

      // Update validation status based on our check
      result.isValid = isValidCert;
      if (!isValidCert) {
        result.suspicionScore += 0.7;
        result.reasons.push('Certificate validation failed');
      }

      // Check for suspicious patterns
      if (result.isSelfSigned) {
        result.suspicionScore += 0.8;
        result.reasons.push('Self-signed certificate detected');
      }

      if (result.age < 7) {
        result.suspicionScore += 0.5;
        result.reasons.push('Very new certificate (< 7 days old)');
      }

      if (result.expiryDays < 30) {
        result.suspicionScore += 0.3;
        result.reasons.push('Certificate expires soon');
      }

      if (result.sanCount > 100) {
        result.suspicionScore += 0.4;
        result.reasons.push('Unusually high number of SANs');
      }

      // Check for suspicious issuers
      const suspiciousIssuers = ['localhost', 'test', 'example', 'invalid'];
      if (suspiciousIssuers.some(sus => result.issuer.toLowerCase().includes(sus))) {
        result.suspicionScore += 0.6;
        result.reasons.push('Suspicious certificate issuer');
      }

      // Certificate Transparency check (simplified)
      if (ctCheckEnabled) {
        try {
          result.ctLogPresent = await checkCertificateTransparency(hostname);
          if (!result.ctLogPresent) {
            result.suspicionScore += 0.4;
            result.reasons.push('Certificate not found in CT logs');
          }
        } catch (err) {
          logger.debug({ hostname, err }, 'CT log check failed');
        }
      }
    }

    return result;
  } catch (err) {
    logger.warn({ hostname, err }, 'Certificate analysis failed');
    result.isValid = false;
    result.suspicionScore += 0.5;
    result.reasons.push('Certificate analysis failed');
    return result;
  }
}

async function checkCertificateTransparency(hostname: string): Promise<boolean> {
  try {
    // Simplified CT log check - in production you'd query actual CT logs
    // This is a placeholder that assumes most legitimate sites are in CT logs
    const response = await request(`https://crt.sh/?q=${encodeURIComponent(hostname)}&output=json`, {
      method: 'GET',
      headersTimeout: 2000,
      bodyTimeout: 2000,
    });

    if (response.statusCode === 200) {
      const data = await response.body.json();
      return Array.isArray(data) && data.length > 0;
    }

    return false;
  } catch (_err) {
    // If CT check fails, assume certificate is present to avoid false positives
    return true;
  }
}