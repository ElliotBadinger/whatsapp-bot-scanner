import { getConfusableCharacters } from 'confusable';
import punycode from 'punycode';

export type HomoglyphRiskLevel = 'none' | 'low' | 'medium' | 'high';

export interface HomoglyphCharacter {
  original: string;
  confusedWith: string;
  position: number;
  script: string;
  alternatives: string[];
}

export interface HomoglyphResult {
  detected: boolean;
  isPunycode: boolean;
  mixedScript: boolean;
  unicodeHostname: string;
  normalizedDomain: string;
  confusableChars: HomoglyphCharacter[];
  riskLevel: HomoglyphRiskLevel;
  riskReasons: string[];
}

const ASCII_PATTERN = /^[\x00-\x7F]+$/;

const BRAND_NAMES = ['google', 'facebook', 'paypal', 'amazon', 'microsoft', 'apple', 'netflix', 'whatsapp'];

const RISK_PRIORITY: Record<HomoglyphRiskLevel, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
};

const PRIORITY_TO_LEVEL: HomoglyphRiskLevel[] = ['none', 'low', 'medium', 'high'];

interface ScriptRange {
  name: string;
  ranges: Array<[number, number]>;
}

const SCRIPT_RANGES: ScriptRange[] = [
  { name: 'Latin', ranges: [
    [0x0041, 0x024F],
    [0x1E00, 0x1EFF],
    [0x2C60, 0x2C7F],
    [0xA720, 0xA7FF],
    [0xFF21, 0xFF3A],
    [0xFF41, 0xFF5A],
  ] },
  { name: 'Greek', ranges: [[0x0370, 0x03FF], [0x1F00, 0x1FFF]] },
  { name: 'Cyrillic', ranges: [[0x0400, 0x052F], [0x2DE0, 0x2DFF], [0xA640, 0xA69F]] },
  { name: 'Armenian', ranges: [[0x0530, 0x058F]] },
  { name: 'Hebrew', ranges: [[0x0590, 0x05FF]] },
  { name: 'Arabic', ranges: [[0x0600, 0x06FF], [0x0750, 0x077F], [0x08A0, 0x08FF]] },
  { name: 'Devanagari', ranges: [[0x0900, 0x097F]] },
  { name: 'Thai', ranges: [[0x0E00, 0x0E7F]] },
  { name: 'Hangul', ranges: [[0x1100, 0x11FF], [0x3130, 0x318F], [0xAC00, 0xD7AF]] },
  { name: 'Han', ranges: [[0x3400, 0x4DBF], [0x4E00, 0x9FFF], [0xF900, 0xFAFF]] },
  { name: 'Katakana', ranges: [[0x30A0, 0x30FF], [0xFF66, 0xFF9F]] },
  { name: 'Hiragana', ranges: [[0x3040, 0x309F]] },
];

export function detectHomoglyphs(domain: string): HomoglyphResult {
  const unicodeHostname = decodeDomain(domain);
  const isPunycode = domain.split('.').some(label => label.startsWith('xn--'));

  const confusableChars: HomoglyphCharacter[] = [];
  const scripts = new Set<string>();
  const riskReasons: string[] = [];

  let asciiSkeletonBuilder = '';
  const characters = Array.from(unicodeHostname);

  characters.forEach((char, index) => {
    if (char === '.') {
      asciiSkeletonBuilder += char;
      return;
    }

    const script = detectScript(char);
    if (script !== 'Common') {
      scripts.add(script);
    }

    const codePoint = char.codePointAt(0);
    const confusableSet = codePoint !== undefined && codePoint > 0x7f
      ? sanitizeAlternatives(char, getConfusableCharacters(char))
      : [];
    const asciiAlternative = confusableSet.find(candidate => ASCII_PATTERN.test(candidate) && candidate.toLowerCase() !== char.toLowerCase());

    let replacement = char;
    if (asciiAlternative) {
      replacement = asciiAlternative;
      confusableChars.push({
        original: char,
        confusedWith: asciiAlternative,
        position: index,
        script,
        alternatives: confusableSet,
      });
    } else if (confusableSet.length > 0 && script !== 'Latin') {
      const fallback = confusableSet[0];
      replacement = fallback;
      confusableChars.push({
        original: char,
        confusedWith: fallback,
        position: index,
        script,
        alternatives: confusableSet,
      });
    }

    asciiSkeletonBuilder += replacement;
  });

  const asciiSkeleton = asciiSkeletonBuilder.toLowerCase();
  const mixedScript = scripts.size > 1;

  let riskPriority = 0;

  if (isPunycode) {
    riskPriority = Math.max(riskPriority, RISK_PRIORITY.low);
    pushUnique(riskReasons, 'Hostname uses punycode/IDN encoding');
  }

  if (mixedScript) {
    riskPriority = Math.max(riskPriority, RISK_PRIORITY.medium);
    pushUnique(riskReasons, `Mixed scripts detected: ${Array.from(scripts).join(', ')}`);
  }

  if (confusableChars.length > 0) {
    riskPriority = Math.max(riskPriority, RISK_PRIORITY.medium);
    confusableChars.forEach(entry => {
      pushUnique(riskReasons, `Confusable character ${entry.original}→${entry.confusedWith} (${entry.script})`);
    });
  }

  if (confusableChars.length >= 2 || (confusableChars.length > 0 && mixedScript) || (isPunycode && confusableChars.length > 0)) {
    riskPriority = Math.max(riskPriority, RISK_PRIORITY.high);
  }

  const brandMatch = detectBrandSpoof(unicodeHostname, asciiSkeleton);
  if (brandMatch) {
    riskPriority = Math.max(riskPriority, RISK_PRIORITY.high);
    pushUnique(riskReasons, `Visually similar to brand "${brandMatch}"`);
  }

  const riskLevel = PRIORITY_TO_LEVEL[riskPriority];
  const detected = isPunycode || mixedScript || confusableChars.length > 0;

  return {
    detected,
    isPunycode,
    mixedScript,
    unicodeHostname,
    normalizedDomain: asciiSkeleton,
    confusableChars,
    riskLevel,
    riskReasons,
  };
}

function decodeDomain(domain: string): string {
  return domain
    .split('.')
    .map(label => (label.startsWith('xn--') ? punycode.toUnicode(label) : label))
    .join('.');
}

function detectScript(char: string): string {
  const codePoint = char.codePointAt(0);
  if (codePoint === undefined) {
    return 'Common';
  }
  if ((codePoint >= 0x0030 && codePoint <= 0x0039) || char === '-' || char === '_') {
    return 'Common';
  }
  for (const script of SCRIPT_RANGES) {
    if (script.ranges.some(([start, end]) => codePoint >= start && codePoint <= end)) {
      return script.name;
    }
  }
  return 'Common';
}

function sanitizeAlternatives(original: string, entries: string[]): string[] {
  if (!Array.isArray(entries)) {
    return [];
  }
  return entries.filter(entry => entry && entry !== original);
}

function detectBrandSpoof(unicodeHostname: string, asciiSkeleton: string): string | null {
  const primaryLabel = unicodeHostname.split('.')[0]?.toLowerCase() ?? unicodeHostname.toLowerCase();
  const normalizedLabel = asciiSkeleton.split('.')[0] ?? asciiSkeleton;
  const normalizedLower = normalizedLabel.toLowerCase();

  for (const brand of BRAND_NAMES) {
    if (primaryLabel === brand) {
      continue;
    }
    const similarityOriginal = stringSimilarity(primaryLabel, brand);
    const similarityNormalized = stringSimilarity(normalizedLower, brand);
    if (Math.max(similarityOriginal, similarityNormalized) > 0.88) {
      return brand;
    }
  }
  return null;
}

function stringSimilarity(a: string, b: string): number {
  const longer = a.length >= b.length ? a : b;
  const shorter = a.length >= b.length ? b : a;
  if (longer.length === 0) return 1;
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i += 1) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j += 1) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i += 1) {
    for (let j = 1; j <= a.length; j += 1) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function pushUnique(reasons: string[], reason: string) {
  if (reason && !reasons.includes(reason)) {
    reasons.push(reason);
  }
}
