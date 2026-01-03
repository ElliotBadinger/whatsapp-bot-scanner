import {
  normalizeLabel,
  resolveExpectedLabel,
  summarizeBucket,
} from "../../../../scripts/scan-utils";

describe("scan utils", () => {
  it("normalizes common label variants", () => {
    expect(normalizeLabel("Phishing")).toBe("malicious");
    expect(normalizeLabel("LEGIT")).toBe("benign");
    expect(normalizeLabel("sus")).toBe("suspicious");
    expect(normalizeLabel("tricky")).toBe("tricky");
  });

  it("resolves expected labels with tricky mapping", () => {
    expect(resolveExpectedLabel("tricky")).toBe("suspicious");
    expect(resolveExpectedLabel("unknown")).toBeNull();
    expect(resolveExpectedLabel("benign")).toBe("benign");
  });

  it("summarizes bucket metrics", () => {
    const summary = summarizeBucket({
      total: 10,
      labeled: 8,
      benign: 5,
      suspicious: 2,
      malicious: 3,
      scoreSum: 25,
      correct: 6,
      missed: 2,
      skipped: 1,
      expectedByLabel: {},
      confusion: {},
      trickyExpected: 0,
      trickyFlagged: 0,
      trickyBlocked: 0,
    });

    expect(summary.flaggedRate).toBe(0.5);
    expect(summary.avgScore).toBe(2.5);
    expect(summary.accuracy).toBe(0.75);
  });
});
