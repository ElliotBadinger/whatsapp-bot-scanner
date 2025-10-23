import { isSuspiciousTld } from './url';
import type { GsbThreatMatch } from './reputation/gsb';
import { detectHomoglyphs } from './homoglyph';
import type { HomoglyphResult } from './homoglyph';

export interface Signals {
  gsbThreatTypes?: string[];
  vtMalicious?: number;
  vtSuspicious?: number;
  vtHarmless?: number;
  urlhausListed?: boolean;
  phishtankVerified?: boolean;
  domainAgeDays?: number;
  isIpLiteral?: boolean;
  hasSuspiciousTld?: boolean;
  redirectCount?: number;
  hasUncommonPort?: boolean;
  urlLength?: number;
  hasExecutableExtension?: boolean;
  wasShortened?: boolean;
  manualOverride?: 'allow' | 'deny' | null;
  finalUrlMismatch?: boolean;
  homoglyph?: HomoglyphResult;
}

export interface RiskVerdict {
  score: number;
  level: 'benign' | 'suspicious' | 'malicious';
  reasons: string[];
  cacheTtl: number;
}

function pushReason(reasons: string[], reason: string) {
  if (reason && !reasons.includes(reason)) {
    reasons.push(reason);
  }
}

export function scoreFromSignals(signals: Signals): RiskVerdict {
  if (signals.manualOverride === 'allow') {
    return { score: 0, level: 'benign', reasons: ['Manually allowed'], cacheTtl: 86400 };
  }
  if (signals.manualOverride === 'deny') {
    return { score: 15, level: 'malicious', reasons: ['Manually blocked'], cacheTtl: 86400 };
  }

  let score = 0;
  const reasons: string[] = [];

  // Blocklist signals
  const threatTypes = signals.gsbThreatTypes ?? [];
  if (threatTypes.includes('MALWARE') || threatTypes.includes('SOCIAL_ENGINEERING')) {
    score += 10;
    pushReason(reasons, `Google Safe Browsing: ${threatTypes.join(', ')}`);
  }
  if (signals.phishtankVerified) {
    score += 10;
    pushReason(reasons, 'Verified phishing (Phishtank)');
  }
  if (signals.urlhausListed) {
    score += 10;
    pushReason(reasons, 'Known malware distribution (URLhaus)');
  }

  const vtMalicious = signals.vtMalicious ?? 0;
  if (vtMalicious >= 3) {
    score += 8;
    pushReason(reasons, `${vtMalicious} VT engines flagged malicious`);
  } else if (vtMalicious >= 1) {
    score += 5;
    pushReason(reasons, `${vtMalicious} VT engine flagged malicious`);
  }

  // Domain age
  if (signals.domainAgeDays !== undefined && signals.domainAgeDays !== null) {
    if (signals.domainAgeDays < 7) {
      score += 6;
      pushReason(reasons, `Domain registered ${signals.domainAgeDays} days ago (<7)`);
    } else if (signals.domainAgeDays < 14) {
      score += 4;
      pushReason(reasons, `Domain registered ${signals.domainAgeDays} days ago (<14)`);
    } else if (signals.domainAgeDays < 30) {
      score += 2;
      pushReason(reasons, `Domain registered ${signals.domainAgeDays} days ago (<30)`);
    }
  }

  // Heuristics
  const homoglyph = signals.homoglyph;
  if (homoglyph?.detected) {
    const characterPairs = homoglyph.confusableChars.map(c => `${c.original}→${c.confusedWith}`).join(', ');
    if (homoglyph.riskLevel === 'high') {
      score += 5;
      pushReason(
        reasons,
        characterPairs
          ? `High-risk homoglyph attack detected (${characterPairs})`
          : 'High-risk homoglyph attack detected',
      );
    } else if (homoglyph.riskLevel === 'medium') {
      score += 3;
      pushReason(
        reasons,
        characterPairs
          ? `Suspicious homoglyph characters detected (${characterPairs})`
          : 'Suspicious homoglyph characters detected',
      );
    } else {
      score += 1;
      const baseReason = homoglyph.isPunycode ? 'Punycode/IDN hostname detected' : 'Internationalized hostname detected';
      pushReason(reasons, characterPairs ? `${baseReason} (${characterPairs})` : baseReason);
    }
    homoglyph.riskReasons
      .filter(reason => !reason.startsWith('Confusable character'))
      .forEach(reason => pushReason(reasons, reason));
  }
  if (signals.isIpLiteral) {
    score += 3;
    pushReason(reasons, 'URL uses IP address');
  }
  if (signals.hasSuspiciousTld) {
    score += 2;
    pushReason(reasons, 'Suspicious TLD');
  }
  if ((signals.redirectCount ?? 0) >= 3) {
    score += 2;
    pushReason(reasons, `Multiple redirects (${signals.redirectCount})`);
  }
  if (signals.hasUncommonPort) {
    score += 2;
    pushReason(reasons, 'Uncommon port');
  }
  if ((signals.urlLength ?? 0) > 200) {
    score += 2;
    pushReason(reasons, `Long URL (${signals.urlLength} chars)`);
  }
  if (signals.hasExecutableExtension) {
    score += 1;
    pushReason(reasons, 'Executable file extension');
  }
  if (signals.wasShortened) {
    score += 1;
    pushReason(reasons, 'Shortened URL expanded');
  }
  if (signals.finalUrlMismatch) {
    score += 2;
    pushReason(reasons, 'Redirect leads to mismatched domain/brand');
  }

  let level: RiskVerdict['level'];
  let cacheTtl: number;
  if (score <= 3) {
    level = 'benign';
    cacheTtl = 86400;
  } else if (score <= 7) {
    level = 'suspicious';
    cacheTtl = 3600;
  } else {
    level = 'malicious';
    cacheTtl = 900;
  }

  return { score, level, reasons, cacheTtl };
}

export function extraHeuristics(u: URL): Partial<Signals> {
  const port = u.port ? parseInt(u.port, 10) : (u.protocol === 'http:' ? 80 : 443);
  const hasUncommonPort = ![80, 443, 8080, 8443].includes(port);
  const isIpLiteral = /^(\d+\.\d+\.\d+\.\d+|\[[0-9a-fA-F:]+\])$/.test(u.hostname);
  const hasExecutableExtension = /\.(exe|msi|apk|bat|cmd|ps1|scr|jar|pkg|dmg|iso)$/i.test(u.pathname);
  const hasSuspiciousTld = isSuspiciousTld(u.hostname);
  const homoglyph = detectHomoglyphs(u.hostname);
  return {
    hasUncommonPort,
    isIpLiteral,
    hasExecutableExtension,
    hasSuspiciousTld,
    urlLength: u.toString().length,
    homoglyph,
  };
}
