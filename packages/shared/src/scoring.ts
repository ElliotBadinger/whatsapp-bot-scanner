import { isSuspiciousTld } from "./url";
import { detectHomoglyphs } from "./homoglyph";
import type { HomoglyphResult } from "./homoglyph";

export interface Signals {
  gsbThreatTypes?: string[];
  vtMalicious?: number;
  vtSuspicious?: number;
  vtHarmless?: number;
  urlhausListed?: boolean;
  phishtankVerified?: boolean;
  certPlListed?: boolean;
  openphishListed?: boolean;
  suspiciousDomainListed?: boolean;
  domainAgeDays?: number;
  isIpLiteral?: boolean;
  hasSuspiciousTld?: boolean;
  redirectCount?: number;
  hasUncommonPort?: boolean;
  urlLength?: number;
  hasExecutableExtension?: boolean;
  wasShortened?: boolean;
  hasUserInfo?: boolean;
  typoSquatTarget?: string;
  typoSquatMethod?: string;
  manualOverride?: "allow" | "deny" | null;
  finalUrlMismatch?: boolean;
  homoglyph?: HomoglyphResult;
  heuristicsOnly?: boolean;
}

export interface RiskVerdict {
  score: number;
  level: "benign" | "suspicious" | "malicious";
  reasons: string[];
  cacheTtl: number;
}

function pushReason(reasons: string[], reason: string) {
  if (reason && !reasons.includes(reason)) {
    reasons.push(reason);
  }
}

function evaluateBlocklistSignals(
  signals: Signals,
  score: number,
  reasons: string[],
): number {
  const threatTypes = signals.gsbThreatTypes ?? [];
  const gsbMaliciousThreatTypes = new Set([
    "MALWARE",
    "SOCIAL_ENGINEERING",
    "UNWANTED_SOFTWARE",
    "MALICIOUS_BINARY",
    "POTENTIALLY_HARMFUL_APPLICATION",
  ]);

  if (threatTypes.some((t) => gsbMaliciousThreatTypes.has(t))) {
    score += 10;
    pushReason(reasons, `Google Safe Browsing: ${threatTypes.join(", ")}`);
  }
  if (signals.phishtankVerified) {
    score += 10;
    pushReason(reasons, "Verified phishing (Phishtank)");
  }
  if (signals.certPlListed) {
    score += 10;
    pushReason(reasons, "Listed as dangerous (CERT Polska)");
  }
  if (signals.openphishListed) {
    score += 10;
    pushReason(reasons, "Known phishing (OpenPhish)");
  }
  if (signals.urlhausListed) {
    score += 10;
    pushReason(reasons, "Known malware distribution (URLhaus)");
  }
  return score;
}

function evaluateVirusTotalSignals(
  signals: Signals,
  score: number,
  reasons: string[],
): number {
  const vtMalicious = signals.vtMalicious ?? 0;
  if (vtMalicious >= 3) {
    score += 8;
    pushReason(reasons, `${vtMalicious} VT engines flagged malicious`);
  } else if (vtMalicious >= 1) {
    score += 5;
    pushReason(reasons, `${vtMalicious} VT engine flagged malicious`);
  }
  return score;
}

function evaluateDomainAge(
  signals: Signals,
  score: number,
  reasons: string[],
): number {
  if (signals.domainAgeDays !== undefined && signals.domainAgeDays !== null) {
    if (signals.domainAgeDays < 7) {
      score += 6;
      pushReason(
        reasons,
        `Domain registered ${signals.domainAgeDays} days ago (<7)`,
      );
    } else if (signals.domainAgeDays < 14) {
      score += 4;
      pushReason(
        reasons,
        `Domain registered ${signals.domainAgeDays} days ago (<14)`,
      );
    } else if (signals.domainAgeDays < 30) {
      score += 2;
      pushReason(
        reasons,
        `Domain registered ${signals.domainAgeDays} days ago (<30)`,
      );
    }
  }
  return score;
}

function evaluateHomoglyphSignals(
  signals: Signals,
  score: number,
  reasons: string[],
): number {
  const homoglyph = signals.homoglyph;
  if (homoglyph?.detected) {
    const characterPairs = homoglyph.confusableChars
      .map((c) => `${c.original}→${c.confusedWith}`)
      .join(", ");
    if (homoglyph.riskLevel === "high") {
      score += 5;
      pushReason(
        reasons,
        characterPairs
          ? `High-risk homoglyph attack detected (${characterPairs})`
          : "High-risk homoglyph attack detected",
      );
    } else if (homoglyph.riskLevel === "medium") {
      score += 3;
      pushReason(
        reasons,
        characterPairs
          ? `Suspicious homoglyph characters detected (${characterPairs})`
          : "Suspicious homoglyph characters detected",
      );
    } else {
      score += 1;
      const baseReason = homoglyph.isPunycode
        ? "Punycode/IDN hostname detected"
        : "Internationalized hostname detected";
      pushReason(
        reasons,
        characterPairs ? `${baseReason} (${characterPairs})` : baseReason,
      );
    }
    homoglyph.riskReasons
      .filter((reason) => !reason.startsWith("Confusable character"))
      .forEach((reason) => pushReason(reasons, reason));
  }
  return score;
}

function evaluateHeuristicSignals(
  signals: Signals,
  score: number,
  reasons: string[],
): number {
  if (signals.isIpLiteral) {
    score += 3;
    pushReason(reasons, "URL uses IP address");
  }
  if (signals.hasSuspiciousTld) {
    score += 2;
    pushReason(reasons, "Suspicious TLD");
  }
  if ((signals.redirectCount ?? 0) >= 3) {
    score += 2;
    pushReason(reasons, `Multiple redirects (${signals.redirectCount})`);
  }
  if (signals.hasUncommonPort) {
    score += 2;
    pushReason(reasons, "Uncommon port");
  }
  if ((signals.urlLength ?? 0) > 200) {
    score += 2;
    pushReason(reasons, `Long URL (${signals.urlLength} chars)`);
  }
  if (signals.hasExecutableExtension) {
    score += 1;
    pushReason(reasons, "Executable file extension");
  }
  if (signals.wasShortened) {
    score += 1;
    pushReason(reasons, "Shortened URL expanded");
  }
  if (signals.hasUserInfo) {
    score += 6;
    pushReason(reasons, "URL contains embedded credentials");
  }
  if (signals.suspiciousDomainListed) {
    score += 5;
    pushReason(reasons, "Domain listed in suspicious activity feed");
  }
  if (signals.typoSquatTarget) {
    score += 5;
    const method = signals.typoSquatMethod
      ? ` (${signals.typoSquatMethod})`
      : "";
    pushReason(
      reasons,
      `Possible typosquat of ${signals.typoSquatTarget}${method}`,
    );
  }
  if (signals.finalUrlMismatch) {
    score += 2;
    pushReason(reasons, "Redirect leads to mismatched domain/brand");
  }
  return score;
}

function determineRiskLevel(finalScore: number): {
  level: RiskVerdict["level"];
  cacheTtl: number;
} {
  if (finalScore <= 3) {
    return { level: "benign", cacheTtl: 86400 };
  } else if (finalScore <= 7) {
    return { level: "suspicious", cacheTtl: 3600 };
  } else {
    return { level: "malicious", cacheTtl: 900 };
  }
}

export function scoreFromSignals(signals: Signals): RiskVerdict {
  if (signals.manualOverride === "allow") {
    return {
      score: 0,
      level: "benign",
      reasons: ["Manually allowed"],
      cacheTtl: 86400,
    };
  }
  if (signals.manualOverride === "deny") {
    return {
      score: 15,
      level: "malicious",
      reasons: ["Manually blocked"],
      cacheTtl: 86400,
    };
  }

  let score = 0;
  const reasons: string[] = [];

  score = evaluateBlocklistSignals(signals, score, reasons);
  score = evaluateVirusTotalSignals(signals, score, reasons);
  score = evaluateDomainAge(signals, score, reasons);
  score = evaluateHomoglyphSignals(signals, score, reasons);
  score = evaluateHeuristicSignals(signals, score, reasons);

  if (signals.heuristicsOnly) {
    pushReason(
      reasons,
      "Heuristics-only scan (external providers unavailable)",
    );
  }

  let finalScore = Math.max(0, Math.min(score, 15));
  const hasHardBlocklist =
    Boolean(signals.openphishListed) ||
    Boolean(signals.urlhausListed) ||
    Boolean(signals.phishtankVerified) ||
    Boolean(signals.certPlListed) ||
    Boolean(signals.gsbThreatTypes && signals.gsbThreatTypes.length > 0) ||
    Boolean((signals.vtMalicious ?? 0) >= 1);
  if (signals.suspiciousDomainListed && !hasHardBlocklist) {
    finalScore = Math.min(finalScore, 7);
  }
  const { level, cacheTtl } = determineRiskLevel(finalScore);

  return { score: finalScore, level, reasons, cacheTtl };
}

export function extraHeuristics(u: URL): Partial<Signals> {
  const port = u.port
    ? parseInt(u.port, 10)
    : u.protocol === "http:"
      ? 80
      : 443;
  const hasUncommonPort = ![80, 443, 8080, 8443].includes(port);
  const isIpLiteral = /^(\d+\.\d+\.\d+\.\d+|\[[0-9a-fA-F:]+\])$/.test(
    u.hostname,
  );
  const hasExecutableExtension =
    /\.(exe|msi|apk|bat|cmd|ps1|scr|jar|pkg|dmg|iso)$/i.test(u.pathname);
  const hasSuspiciousTld = isSuspiciousTld(u.hostname);
  const homoglyph = detectHomoglyphs(u.hostname);
  const hasUserInfo = Boolean(u.username || u.password);
  return {
    hasUncommonPort,
    isIpLiteral,
    hasExecutableExtension,
    hasSuspiciousTld,
    urlLength: u.toString().length,
    homoglyph,
    hasUserInfo,
  };
}
