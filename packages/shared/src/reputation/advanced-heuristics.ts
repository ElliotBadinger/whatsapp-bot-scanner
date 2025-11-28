import { logger } from "../log";

export interface SubdomainAnalysis {
  count: number;
  maxDepth: number;
  hasNumericSubdomains: boolean;
  suspicionScore: number;
}

export interface AdvancedHeuristicsResult {
  score: number;
  reasons: string[];
  entropy: number;
  subdomainAnalysis: SubdomainAnalysis;
  suspiciousPatterns: string[];
}

export async function advancedHeuristics(
  url: string,
): Promise<AdvancedHeuristicsResult> {
  const result: AdvancedHeuristicsResult = {
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

  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;
    const pathname = parsed.pathname;
    const fullUrl = url;

    // Shannon entropy analysis
    result.entropy = calculateShannonEntropy(hostname);
    if (result.entropy > 4.5) {
      result.score += 0.6;
      result.reasons.push("High entropy in hostname (possible DGA)");
    }

    // Subdomain analysis
    result.subdomainAnalysis = analyzeSubdomains(hostname);
    result.score += result.subdomainAnalysis.suspicionScore;
    if (result.subdomainAnalysis.suspicionScore > 0) {
      result.reasons.push("Suspicious subdomain structure");
    }

    // Keyboard walk detection
    const keyboardWalk = detectKeyboardWalk(hostname);
    if (keyboardWalk) {
      result.score += 0.4;
      result.reasons.push("Keyboard walk pattern detected");
      result.suspiciousPatterns.push("keyboard_walk");
    }

    // Suspicious character patterns
    const suspiciousChars = detectSuspiciousCharacters(fullUrl);
    if (suspiciousChars.length > 0) {
      result.score += 0.3 * suspiciousChars.length;
      result.reasons.push(
        `Suspicious characters: ${suspiciousChars.join(", ")}`,
      );
      result.suspiciousPatterns.push(...suspiciousChars);
    }

    // URL length analysis
    if (fullUrl.length > 200) {
      result.score += 0.3;
      result.reasons.push("Unusually long URL");
    }

    // Path depth analysis
    const pathDepth = pathname.split("/").filter(Boolean).length;
    if (pathDepth > 8) {
      result.score += 0.2;
      result.reasons.push("Deep path structure");
    }

    // Suspicious TLD patterns
    const tld = hostname.split(".").pop()?.toLowerCase();
    const suspiciousTlds = ["tk", "ml", "ga", "cf", "click", "download"];
    if (tld && suspiciousTlds.includes(tld)) {
      result.score += 0.4;
      result.reasons.push(`Suspicious TLD: .${tld}`);
    }

    // Homograph detection (basic)
    const homographs = detectBasicHomographs(hostname);
    if (homographs.length > 0) {
      result.score += 0.5;
      result.reasons.push("Potential homograph attack");
      result.suspiciousPatterns.push("homograph");
    }

    return result;
  } catch (err) {
    logger.warn({ url, err }, "Advanced heuristics analysis failed");
    return result;
  }
}

function calculateShannonEntropy(str: string): number {
  const freq: { [key: string]: number } = {};

  // Count character frequencies
  for (const char of str) {
    freq[char] = (freq[char] || 0) + 1;
  }

  let entropy = 0;
  const len = str.length;

  for (const count of Object.values(freq)) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }

  return entropy;
}

function analyzeSubdomains(hostname: string): SubdomainAnalysis {
  const parts = hostname.split(".");
  const subdomains = parts.slice(0, -2); // Remove domain and TLD

  const analysis: SubdomainAnalysis = {
    count: subdomains.length,
    maxDepth: subdomains.length,
    hasNumericSubdomains: false,
    suspicionScore: 0,
  };

  // Check for numeric subdomains
  analysis.hasNumericSubdomains = subdomains.some((sub) => /^\d+$/.test(sub));
  if (analysis.hasNumericSubdomains) {
    analysis.suspicionScore += 0.3;
  }

  // Excessive subdomain depth
  if (analysis.count > 4) {
    analysis.suspicionScore += 0.4;
  }

  // Very long subdomains
  const longSubdomains = subdomains.filter((sub) => sub.length > 20);
  if (longSubdomains.length > 0) {
    analysis.suspicionScore += 0.3;
  }

  return analysis;
}

function detectKeyboardWalk(str: string): boolean {
  const keyboardRows = ["qwertyuiop", "asdfghjkl", "zxcvbnm", "1234567890"];

  for (const row of keyboardRows) {
    for (let i = 0; i <= row.length - 4; i++) {
      const pattern = row.slice(i, i + 4);
      if (str.toLowerCase().includes(pattern)) {
        return true;
      }
    }
  }

  return false;
}

function detectSuspiciousCharacters(url: string): string[] {
  const suspicious: string[] = [];

  // Multiple consecutive hyphens
  if (/-{2,}/.test(url)) {
    suspicious.push("multiple_hyphens");
  }

  // Mixed scripts (basic check)
  if (/[а-я]/.test(url) && /[a-z]/.test(url)) {
    suspicious.push("mixed_scripts");
  }

  // Unusual Unicode characters
  if (/[^\x00-\x7F]/.test(url)) {
    suspicious.push("unicode_chars");
  }

  // Excessive dots
  if ((url.match(/\./g) || []).length > 8) {
    suspicious.push("excessive_dots");
  }

  return suspicious;
}

function detectBasicHomographs(hostname: string): string[] {
  const homographs: string[] = [];

  // Common homograph substitutions
  const substitutions = {
    a: ["а", "à", "á", "â", "ã", "ä", "å"],
    e: ["е", "è", "é", "ê", "ë"],
    o: ["о", "ò", "ó", "ô", "õ", "ö"],
    p: ["р"],
    c: ["с"],
    x: ["х"],
  };

  for (const [latin, variants] of Object.entries(substitutions)) {
    for (const variant of variants) {
      if (hostname.includes(variant)) {
        homographs.push(`${latin}->${variant}`);
      }
    }
  }

  return homographs;
}
