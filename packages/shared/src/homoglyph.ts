import removeConfusables from 'confusables';
import punycode from 'punycode';

export interface HomoglyphResult {
  detected: boolean;
  confusableChars: Array<{ original: string; confusedWith: string; position: number }>;
  normalizedDomain: string;
  riskLevel: 'none' | 'low' | 'medium' | 'high';
}

const BRAND_NAMES = ['google', 'facebook', 'paypal', 'amazon', 'microsoft', 'apple', 'netflix', 'whatsapp'];

export function detectHomoglyphs(domain: string): HomoglyphResult {
  const unicodeDomain = decodeDomain(domain);
  const confusableChars: HomoglyphResult['confusableChars'] = [];
  let detected = false;
  let riskLevel: HomoglyphResult['riskLevel'] = 'none';

  const isPunycode = domain.includes('xn--');
  if (isPunycode) {
    detected = true;
    riskLevel = 'medium';
  }

  const chars = Array.from(unicodeDomain);
  chars.forEach((char, index) => {
    const normalized = removeConfusables(char);
    if (normalized !== char) {
      detected = true;
      confusableChars.push({ original: char, confusedWith: normalized, position: index });
    }
  });

  if (confusableChars.length > 0) {
    const brandMatch = isBrandImitating(unicodeDomain);
    if (confusableChars.length >= 3 || brandMatch) {
      riskLevel = 'high';
    } else if (confusableChars.length >= 2 || containsMixedScripts(unicodeDomain)) {
      riskLevel = 'medium';
    } else if (riskLevel === 'none') {
      riskLevel = 'low';
    }
  }

  return {
    detected,
    confusableChars,
    normalizedDomain: unicodeDomain,
    riskLevel,
  };
}

function decodeDomain(domain: string): string {
  try {
    return domain
      .split('.')
      .map(label => (label.startsWith('xn--') ? punycode.toUnicode(label) : label))
      .join('.');
  } catch {
    return domain;
  }
}

function containsMixedScripts(text: string): boolean {
  const scripts = new Set<string>();
  for (const char of text) {
    const code = char.codePointAt(0);
    if (code === undefined) continue;
    if ((code >= 0x0041 && code <= 0x024F) || code === 0x00DF) {
      scripts.add('Latin');
    } else if (code >= 0x0370 && code <= 0x03FF) {
      scripts.add('Greek');
    } else if (code >= 0x0400 && code <= 0x052F) {
      scripts.add('Cyrillic');
    }
  }
  return scripts.size > 1;
}

function isBrandImitating(domain: string): boolean {
  const primaryLabel = domain.split('.')[0]?.toLowerCase() ?? domain.toLowerCase();
  const normalizedLabel = removeConfusables(primaryLabel);
  return BRAND_NAMES.some(brand => {
    const similarityOriginal = stringSimilarity(primaryLabel, brand);
    const similarityNormalized = stringSimilarity(normalizedLabel, brand);
    const similarity = Math.max(similarityOriginal, similarityNormalized);
    return similarity > 0.85 && primaryLabel !== brand;
  });
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
  const aLength = a.length;
  const bLength = b.length;

  for (let i = 0; i <= bLength; i += 1) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= aLength; j += 1) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= bLength; i += 1) {
    for (let j = 1; j <= aLength; j += 1) {
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
  return matrix[bLength][aLength];
}
