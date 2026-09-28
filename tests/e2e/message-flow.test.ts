import { describe, expect, it } from "vitest";

import {
  detectHomoglyphs,
  extractUrls,
  normalizeUrl,
  scoreFromSignals,
  extraHeuristics,
} from "@wbscanner/shared";
import { formatGroupVerdict } from "../../services/wa-client/src/index";

describe("End-to-end message to verdict flow", () => {
  it("extracts URLs, scores signals, and formats a verdict message", () => {
    const message = "Heads up: http://login.paypa1.test/account?id=42";
    const urls = extractUrls(message);
    expect(urls).toContain("http://login.paypa1.test/account?id=42");

    const primary = urls.find((url) =>
      url.startsWith("http://login.paypa1.test/"),
    );
    expect(primary).toBe("http://login.paypa1.test/account?id=42");

    const normalized = normalizeUrl(primary!);
    expect(normalized).toBe("http://login.paypa1.test/account?id=42");

    const finalUrl = new URL(normalized!);
    const heuristics = extraHeuristics(finalUrl);

    const signals = {
      ...heuristics,
      gsbThreatTypes: ["SOCIAL_ENGINEERING"],
      vtMalicious: 3,
      domainAgeDays: 2,
      wasShortened: false,
      finalUrlMismatch: false,
      homoglyph: detectHomoglyphs(finalUrl.hostname),
    };

    const verdict = scoreFromSignals(signals);
    expect(verdict.level).toBe("malicious");
    expect(verdict.reasons).toContain(
      "Google Safe Browsing: SOCIAL_ENGINEERING",
    );

    const formatted = formatGroupVerdict(
      verdict.level,
      verdict.reasons,
      normalized!,
    );
    expect(formatted).toContain("Link scan: MALICIOUS");
    expect(formatted).toContain("SOCIAL_ENGINEERING");
    expect(formatted).toContain("paypa1");
  });
});
