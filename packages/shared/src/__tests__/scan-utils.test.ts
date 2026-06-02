import {
  normalizeLabel,
  resolveExpectedLabel,
  summarizeBucket,
  createEmptyBucket,
  mergeBuckets,
} from "../../../../scripts/scan-utils";

describe("scan utils", () => {
  it("normalizes common label variants", () => {
    expect(normalizeLabel("Phishing")).toBe("malicious");
    expect(normalizeLabel("LEGIT")).toBe("benign");
    expect(normalizeLabel("sus")).toBe("suspicious");
    expect(normalizeLabel("tricky")).toBe("tricky");
    expect(normalizeLabel("benign-hard")).toBe("benign-hard");
  });

  it("resolves expected labels with tricky mapping", () => {
    expect(resolveExpectedLabel("tricky")).toBe("suspicious");
    expect(resolveExpectedLabel("unknown")).toBeNull();
    expect(resolveExpectedLabel("benign")).toBe("benign");
    expect(resolveExpectedLabel("benign-hard")).toBe("benign");
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

  it("merges buckets for slice aggregation without double-counting", () => {
    const a = createEmptyBucket();
    a.total = 2;
    a.labeled = 2;
    a.malicious = 1;
    a.expectedByLabel = { malicious: 2 };
    a.confusion = { malicious: { malicious: 1, benign: 1 } };

    const b = createEmptyBucket();
    b.total = 3;
    b.labeled = 3;
    b.suspicious = 3;
    b.expectedByLabel = { malicious: 1, suspicious: 2 };
    b.confusion = { malicious: { suspicious: 1 }, suspicious: { suspicious: 2 } };

    const merged = mergeBuckets(createEmptyBucket(), a);
    mergeBuckets(merged, b);

    expect(merged.total).toBe(5);
    expect(merged.expectedByLabel).toEqual({ malicious: 3, suspicious: 2 });
    // malicious row: 1 (from a) + 1 (from b) called other-than-malicious
    expect(merged.confusion.malicious).toEqual({ malicious: 1, benign: 1, suspicious: 1 });
    expect(merged.confusion.suspicious).toEqual({ suspicious: 2 });

    // flagged recall over all positive-expected (malicious+suspicious):
    // tp = (malicious->malicious 1) + (malicious->suspicious 1) + (suspicious->suspicious 2) = 4
    // fn = (malicious->benign 1) = 1  => 4/5 = 0.8
    const summary = summarizeBucket(merged);
    expect(summary.flagged.recall).toBeCloseTo(0.8, 1);
  });
});
