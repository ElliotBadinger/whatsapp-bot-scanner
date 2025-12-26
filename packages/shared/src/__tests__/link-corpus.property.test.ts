import fc from "fast-check";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { dedupeEntries } = require("../../../../scripts/link-corpus");

describe("link corpus properties", () => {
  test("PROPERTY: dedupeEntries keeps highest priority per URL", () => {
    const labelArb = fc.constantFrom(
      "benign",
      "suspicious",
      "malicious",
      "tricky",
    );

    const urlArb = fc
      .stringOf(fc.constantFrom("a", "b", "c", "d"), {
        minLength: 1,
        maxLength: 6,
      })
      .map((token) => `https://${token}.example.com`);

    const entryArb = fc.record({
      url: urlArb,
      label: labelArb,
    });

    const priority = {
      malicious: 3,
      suspicious: 2,
      tricky: 1,
      benign: 0,
    } as const;

    fc.assert(
      fc.property(
        fc.array(entryArb, { minLength: 1, maxLength: 30 }),
        (entries) => {
          const deduped = dedupeEntries(entries);
          const maxByUrl = new Map<string, number>();
          for (const entry of entries) {
            const current = maxByUrl.get(entry.url) ?? -1;
            const score = priority[entry.label as keyof typeof priority] ?? -1;
            if (score > current) {
              maxByUrl.set(entry.url, score);
            }
          }

          expect(deduped).toHaveLength(maxByUrl.size);
          for (const entry of deduped) {
            expect(priority[entry.label as keyof typeof priority]).toBe(
              maxByUrl.get(entry.url),
            );
          }
        },
      ),
    );
  });
});
