import { logger } from '../log';
import { metrics } from '../metrics';
import { Counter } from 'prom-client';

const heuristicDetectionTotal = new Counter({
  name: 'heuristic_detection_total',
  help: 'Total number of heuristic detections',
  labelNames: ['type'],
  registers: [metrics],
});

interface SubdomainAnalysis {
  count: number;
  maxDepth: number;
  hasNumericSubdomains: boolean;
  suspicionScore: number;
}

interface AdvancedHeuristicsResult {
  score: number;
  reasons: string[];
  entropy: number;
  subdomainAnalysis: SubdomainAnalysis;
  suspiciousPatterns: string[];
}

const SUSPICIOUS_PATTERNS = [
  { regex: /\/wp-(admin|login|content)\/[a-z0-9]{20,}/i, name: 'Compromised WordPress', score: 0.15 },
  { regex: /\/(login|signin|account).*\d{10,}/i, name: 'Fake login with session', score: 0.15 },
  { regex: /\/verify.*account.*[a-z0-9]{30,}/i, name: 'Phishing verify', score: 0.15 },
  { regex: /\.(php|asp|jsp)\?.*=.*http/i, name: 'Open redirect', score: 0.15 },
  { regex: /\/(secure|update|confirm).*\.(php|asp|jsp)/i, name: 'Suspicious action page', score: 0.1 },
  { regex: /\/[a-z0-9]{32,}\.(php|html)/i, name: 'Random hash file', score: 0.12 },
  { regex: /\/(paypal|amazon|apple|microsoft|google).*verify/i, name: 'Brand impersonation', score: 0.2 },
  { regex: /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/i, name: 'IP address in URL', score: 0.1 },
];

const KEYBOARD_WALKS = [
  'qwerty', 'asdfgh', 'zxcvbn', 'qazwsx', 'qwertyuiop',
  'asdfghjkl', 'zxcvbnm', '1qaz2wsx', '123456', 'abcdef',
];

function calculateEntropy(text: string): number {
  if (!text || text.length === 0) {
    return 0;
  }

  const frequencies = new Map<string, number>();
  for (const char of text) {
    frequencies.set(char, (frequencies.get(char) || 0) + 1);
  }

  let entropy = 0;
  const length = text.length;

  for (const count of frequencies.values()) {
    const probability = count / length;
    entropy -= probability * Math.log2(probability);
  }

  return entropy;
}

function detectKeyboardWalks(text: string): boolean {
  const lowerText = text.toLowerCase();
  return KEYBOARD_WALKS.some((walk) => lowerText.includes(walk));
}

function analyzeSubdomains(hostname: string): SubdomainAnalysis {
  const parts = hostname.split('.');
  const count = parts.length - 2;
  const maxDepth = parts.length;

  const hasNumericSubdomains = parts.slice(0, -2).some((part) => /^\d+$/.test(part));

  let suspicionScore = 0;

  if (count > 5) {
    suspicionScore += 0.2;
  }

  if (hasNumericSubdomains) {
    suspicionScore += 0.1;
  }

  if (maxDepth > 4) {
    suspicionScore += 0.15;
  }

  return {
    count,
    maxDepth,
    hasNumericSubdomains,
    suspicionScore,
  };
}

function detectSuspiciousPatterns(url: string): string[] {
  const detected: string[] = [];

  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.regex.test(url)) {
      detected.push(pattern.name);
      heuristicDetectionTotal.labels(pattern.name).inc();
    }
  }

  return detected;
}

function analyzeHostnameEntropy(hostname: string): { entropy: number; score: number; reasons: string[] } {
  const entropy = calculateEntropy(hostname);
  const reasons: string[] = [];
  let score = 0;

  if (entropy > 4.5) {
    score += 0.3;
    reasons.push(`High hostname entropy (${entropy.toFixed(2)})`);
    heuristicDetectionTotal.labels('high_entropy_hostname').inc();
  }

  const numberRatio = (hostname.match(/\d/g) || []).length / hostname.length;
  if (numberRatio > 0.5) {
    score += 0.2;
    reasons.push(`Excessive numbers in hostname (${(numberRatio * 100).toFixed(0)}%)`);
    heuristicDetectionTotal.labels('excessive_numbers').inc();
  }

  if (detectKeyboardWalks(hostname)) {
    score += 0.2;
    reasons.push('Keyboard walk pattern detected in hostname');
    heuristicDetectionTotal.labels('keyboard_walk').inc();
  }

  return { entropy, score, reasons };
}

function analyzePathEntropy(pathname: string): { entropy: number; score: number; reasons: string[] } {
  if (!pathname || pathname === '/') {
    return { entropy: 0, score: 0, reasons: [] };
  }

  const entropy = calculateEntropy(pathname);
  const reasons: string[] = [];
  let score = 0;

  if (entropy > 5.0) {
    score += 0.2;
    reasons.push(`High path entropy (${entropy.toFixed(2)})`);
    heuristicDetectionTotal.labels('high_entropy_path').inc();
  }

  return { entropy, score, reasons };
}

export function advancedHeuristics(url: string): AdvancedHeuristicsResult {
  const reasons: string[] = [];
  let score = 0;

  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;
    const pathname = parsed.pathname;

    const hostnameAnalysis = analyzeHostnameEntropy(hostname);
    score += hostnameAnalysis.score;
    reasons.push(...hostnameAnalysis.reasons);

    const pathAnalysis = analyzePathEntropy(pathname);
    score += pathAnalysis.score;
    reasons.push(...pathAnalysis.reasons);

    const subdomainAnalysis = analyzeSubdomains(hostname);
    score += subdomainAnalysis.suspicionScore;

    if (subdomainAnalysis.count > 5) {
      reasons.push(`Excessive subdomains (${subdomainAnalysis.count})`);
      heuristicDetectionTotal.labels('excessive_subdomains').inc();
    }

    if (subdomainAnalysis.hasNumericSubdomains) {
      reasons.push('Numeric subdomains detected');
      heuristicDetectionTotal.labels('numeric_subdomains').inc();
    }

    if (subdomainAnalysis.maxDepth > 4) {
      reasons.push(`Deep subdomain nesting (depth ${subdomainAnalysis.maxDepth})`);
      heuristicDetectionTotal.labels('deep_nesting').inc();
    }

    const suspiciousPatterns = detectSuspiciousPatterns(url);
    for (const pattern of suspiciousPatterns) {
      score += 0.15;
      reasons.push(`Suspicious pattern: ${pattern}`);
    }

    const entropy = Math.max(hostnameAnalysis.entropy, pathAnalysis.entropy);

    if (score > 0) {
      logger.debug({ url, score, reasons }, 'Advanced heuristics detected suspicious indicators');
    }

    return {
      score,
      reasons,
      entropy,
      subdomainAnalysis,
      suspiciousPatterns,
    };
  } catch (err: any) {
    logger.warn({ url, error: err.message }, 'Advanced heuristics analysis failed');

    return {
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
  }
}

export type { AdvancedHeuristicsResult, SubdomainAnalysis };
