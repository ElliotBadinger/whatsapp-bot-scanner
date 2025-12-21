import { getConfusableCharacters } from "confusable";
import punycode from "punycode";

export type HomoglyphRiskLevel = "none" | "low" | "medium" | "high";

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

const BRAND_NAMES = [
  "google",
  "facebook",
  "paypal",
  "amazon",
  "microsoft",
  "apple",
  "netflix",
  "whatsapp",
];

const RISK_PRIORITY: Record<HomoglyphRiskLevel, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
};

const PRIORITY_TO_LEVEL: HomoglyphRiskLevel[] = [
  "none",
  "low",
  "medium",
  "high",
];

interface ScriptRange {
  name: string;
  ranges: Array<[number, number]>;
}

const SCRIPT_RANGES: ScriptRange[] = [
  {
    name: "Latin",
    ranges: [
      [0x0041, 0x024f],
      [0x1e00, 0x1eff],
      [0x2c60, 0x2c7f],
      [0xa720, 0xa7ff],
      [0xff21, 0xff3a],
      [0xff41, 0xff5a],
    ],
  },
  {
    name: "Greek",
    ranges: [
      [0x0370, 0x03ff],
      [0x1f00, 0x1fff],
    ],
  },
  {
    name: "Cyrillic",
    ranges: [
      [0x0400, 0x052f],
      [0x2de0, 0x2dff],
      [0xa640, 0xa69f],
    ],
  },
  { name: "Armenian", ranges: [[0x0530, 0x058f]] },
  { name: "Hebrew", ranges: [[0x0590, 0x05ff]] },
  {
    name: "Arabic",
    ranges: [
      [0x0600, 0x06ff],
      [0x0750, 0x077f],
      [0x08a0, 0x08ff],
    ],
  },
  { name: "Devanagari", ranges: [[0x0900, 0x097f]] },
  { name: "Thai", ranges: [[0x0e00, 0x0e7f]] },
  {
    name: "Hangul",
    ranges: [
      [0x1100, 0x11ff],
      [0x3130, 0x318f],
      [0xac00, 0xd7af],
    ],
  },
  {
    name: "Han",
    ranges: [
      [0x3400, 0x4dbf],
      [0x4e00, 0x9fff],
      [0xf900, 0xfaff],
    ],
  },
  {
    name: "Katakana",
    ranges: [
      [0x30a0, 0x30ff],
      [0xff66, 0xff9f],
    ],
  },
  { name: "Hiragana", ranges: [[0x3040, 0x309f]] },
];

export function detectHomoglyphs(domain: string): HomoglyphResult {
  const unicodeHostname = decodeDomain(domain);
  const isPunycode = domain
    .split(".")
    .some((label) => label.startsWith("xn--"));

  const confusableChars: HomoglyphCharacter[] = [];
  const scripts = new Set<string>();
  const riskReasons: string[] = [];

  let asciiSkeletonBuilder = "";
  const characters = Array.from(unicodeHostname);

  characters.forEach((char, index) => {
    if (char === ".") {
      asciiSkeletonBuilder += char;
      return;
    }

    const script = detectScript(char);
    if (script !== "Common") {
      scripts.add(script);
    }

    const codePoint = char.codePointAt(0);
    const confusableSet =
      codePoint !== undefined && codePoint > 0x7f
        ? sanitizeAlternatives(char, getConfusableCharacters(char))
        : [];
    const asciiAlternative = confusableSet.find(
      (candidate) =>
        ASCII_PATTERN.test(candidate) &&
        candidate.toLowerCase() !== char.toLowerCase(),
    );

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
    } else if (confusableSet.length > 0 && script !== "Latin") {
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
    pushUnique(riskReasons, "Hostname uses punycode/IDN encoding");
  }

  if (mixedScript) {
    riskPriority = Math.max(riskPriority, RISK_PRIORITY.medium);
    pushUnique(
      riskReasons,
      `Mixed scripts detected: ${Array.from(scripts).join(", ")}`,
    );
  }

  if (confusableChars.length > 0) {
    riskPriority = Math.max(riskPriority, RISK_PRIORITY.medium);
    confusableChars.forEach((entry) => {
      pushUnique(
        riskReasons,
        `Confusable character ${entry.original}→${entry.confusedWith} (${entry.script})`,
      );
    });
  }

  if (
    confusableChars.length >= 2 ||
    (confusableChars.length > 0 && mixedScript) ||
    (isPunycode && confusableChars.length > 0)
  ) {
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
    .split(".")
    .map((label) => {
      if (!label.startsWith("xn--")) {
        return label;
      }

      try {
        const decoded = punycode.toUnicode(label);
        return decoded || label;
      } catch {
        return label;
      }
    })
    .join(".");
}

function detectScript(char: string): string {
  const codePoint = char.codePointAt(0);
  if (codePoint === undefined) {
    return "Common";
  }
  if (
    (codePoint >= 0x0030 && codePoint <= 0x0039) ||
    char === "-" ||
    char === "_"
  ) {
    return "Common";
  }
  for (const script of SCRIPT_RANGES) {
    if (
      script.ranges.some(
        ([start, end]) => codePoint >= start && codePoint <= end,
      )
    ) {
      return script.name;
    }
  }
  return "Common";
}

function sanitizeAlternatives(original: string, entries: string[]): string[] {
  if (!Array.isArray(entries)) {
    return [];
  }
  return entries.filter((entry) => entry && entry !== original);
}

function detectBrandSpoof(
  unicodeHostname: string,
  asciiSkeleton: string,
): string | null {
  const primaryLabel =
    unicodeHostname.split(".")[0]?.toLowerCase() ??
    unicodeHostname.toLowerCase();
  const normalizedLabel = asciiSkeleton.split(".")[0] ?? asciiSkeleton;
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
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  if (a.length > b.length) {
    [a, b] = [b, a];
  }

  let row = Array.from({ length: a.length + 1 }, (_, i) => i);
  let nextRow = new Array(a.length + 1);

  for (let i = 1; i <= b.length; i += 1) {
    nextRow[0] = i;
    for (let j = 1; j <= a.length; j += 1) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        nextRow[j] = row[j - 1];
      } else {
        nextRow[j] = Math.min(
          row[j - 1] + 1, // substitution
          row[j] + 1, // deletion
          nextRow[j - 1] + 1, // insertion
        );
      }
    }
    [row, nextRow] = [nextRow, row];
  }
  return row[a.length];
}

function pushUnique(reasons: string[], reason: string) {
  if (reason && !reasons.includes(reason)) {
    reasons.push(reason);
  }
}
