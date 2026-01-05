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

type SuspiciousPattern = {
  id: string;
  name: string;
  regex: RegExp;
  score: number;
};

const SUSPICIOUS_PATTERNS: SuspiciousPattern[] = [
  {
    id: "compromised-wp",
    name: "Compromised WordPress",
    regex: /\/wp-(admin|login|content)\/[a-z0-9]{20,}/i,
    score: 0.25,
  },
  {
    id: "fake-login-session",
    name: "Fake login with session",
    regex: /\/(login|signin|account).*\d{10,}/i,
    score: 0.2,
  },
  {
    id: "verify-account",
    name: "Phishing verify flow",
    regex: /\/verify.*account.*[a-z0-9]{30,}/i,
    score: 0.25,
  },
  {
    id: "open-redirect",
    name: "Open redirect",
    regex: /\.(php|asp|jsp)\?.*=.*http/i,
    score: 0.25,
  },
  {
    id: "suspicious-action",
    name: "Suspicious action page",
    regex: /\/(secure|update|confirm).*\.(php|asp|jsp)/i,
    score: 0.2,
  },
  {
    id: "random-hash-file",
    name: "Random hash file",
    regex: /\/[a-z0-9]{32,}\.(php|html)/i,
    score: 0.25,
  },
  {
    id: "brand-impersonation",
    name: "Brand impersonation",
    regex: /\/(paypal|amazon|apple|microsoft|google).*verify/i,
    score: 0.35,
  },
  {
    id: "ip-with-port",
    name: "IP address with port",
    regex: /https?:\/\/\d{1,3}(?:\.\d{1,3}){3}:\d{2,5}\//i,
    score: 1.0,
  },

  // Hard-mode: wrappers, cloud-abuse, deep-link fallback, "ClickFix" lures.
  {
    id: "wrapper-proofpoint",
    name: "Proofpoint URLDefense wrapper",
    regex: /https?:\/\/urldefense\.proofpoint\.com\/v2\/url\?/i,
    score: 0.9,
  },
  {
    id: "wrapper-facebook",
    name: "Facebook link shim",
    regex: /https?:\/\/l\.facebook\.com\/l\.php\?/i,
    score: 0.35,
  },
  {
    id: "wrapper-google",
    name: "Google link shim",
    regex: /https?:\/\/www\.google\.com\/url\?/i,
    score: 0.35,
  },
  {
    id: "wrapper-safelinks",
    name: "Microsoft SafeLinks wrapper",
    regex: /https?:\/\/[^/]+\.safelinks\.protection\.outlook\.com\//i,
    score: 0.9,
  },
  {
    id: "google-business-redirect",
    name: "Google Business redirect",
    regex:
      /https?:\/\/business\.google\.com\/website_shared\/launch_bw\.html\?/i,
    score: 0.9,
  },

  {
    id: "cloudflare-pages",
    name: "Cloudflare Pages hosting",
    regex: /https?:\/\/[^/]+\.pages\.dev\//i,
    score: 0.35,
  },
  {
    id: "cloudflare-workers",
    name: "Cloudflare Workers hosting",
    regex: /https?:\/\/[^/]+\.workers\.dev\//i,
    score: 0.35,
  },

  {
    id: "appsflyer-onelink",
    name: "AppsFlyer OneLink",
    regex: /https?:\/\/[^/]*onelink\.me\//i,
    score: 0.35,
  },
  {
    id: "appsflyer-fallback",
    name: "AppsFlyer web fallback URL",
    regex: /[?&]af_web_dp=https?:\/\//i,
    score: 1.0,
  },
  {
    id: "branch-deeplink",
    name: "Branch deep link",
    regex: /https?:\/\/[^/]*app\.link\//i,
    score: 0.35,
  },
  {
    id: "branch-fallback",
    name: "Branch fallback URL",
    regex: /[?&]\\$fallback_url=https?:\/\//i,
    score: 1.0,
  },
  {
    id: "firebase-fallback",
    name: "Firebase dynamic link fallback",
    regex: /[?&]ofl=https?:\/\//i,
    score: 1.0,
  },

  {
    id: "clickfix-lure",
    name: "ClickFix lure path",
    regex: /\/verify-human\/|\/how-to-fix\/|\/clickfix\/|\/fix\b/i,
    score: 0.9,
  },
  {
    id: "phaas-resphp",
    name: "PhaaS kit artifact (res###.php)",
    regex: /\/cgi-bin\/res\d{3}\.php\?/i,
    score: 1.0,
  },

  {
    id: "linktree-space",
    name: "Linktree space bypass",
    regex: /https?:\/\/linktr\.ee\/%20/i,
    score: 0.4,
  },
  {
    id: "link-in-bio",
    name: "Link-in-bio service",
    regex: /https?:\/\/(?:bio\.link|linktr\.ee)\//i,
    score: 0.25,
  },
];

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

    // High-signal patterns (use per-pattern score; avoid constant scoring).
    for (const pattern of SUSPICIOUS_PATTERNS) {
      if (pattern.regex.test(fullUrl)) {
        result.score += pattern.score;
        result.reasons.push(`Suspicious pattern: ${pattern.name}`);
        result.suspiciousPatterns.push(pattern.id);
      }
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
  const subdomains = parts.slice(0, -2);

  const analysis: SubdomainAnalysis = {
    count: subdomains.length,
    maxDepth: subdomains.length,
    hasNumericSubdomains: false,
    suspicionScore: 0,
  };

  analysis.hasNumericSubdomains = subdomains.some((sub) => /^\d+$/.test(sub));
  if (analysis.hasNumericSubdomains) {
    analysis.suspicionScore += 0.3;
  }

  if (analysis.count > 4) {
    analysis.suspicionScore += 0.4;
  }

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

  if (/-{2,}/.test(url)) {
    suspicious.push("multiple_hyphens");
  }

  if (/[а-я]/.test(url) && /[a-z]/.test(url)) {
    suspicious.push("mixed_scripts");
  }

  if (/[^\x00-\x7F]/.test(url)) {
    suspicious.push("unicode_chars");
  }

  if ((url.match(/\./g) || []).length > 8) {
    suspicious.push("excessive_dots");
  }

  return suspicious;
}

function detectBasicHomographs(hostname: string): string[] {
  const homographs: string[] = [];

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
