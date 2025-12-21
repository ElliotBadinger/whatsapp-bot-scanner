import { isValidCsrfPair } from "../lib/csrf-shared";

describe("csrf-shared", () => {
  it("accepts matching cookie and header values", () => {
    expect(isValidCsrfPair({ csrfCookie: "token", csrfHeader: "token" })).toBe(
      true,
    );
  });

  it("rejects missing cookie or header", () => {
    expect(
      isValidCsrfPair({ csrfCookie: undefined, csrfHeader: "token" }),
    ).toBe(false);
    expect(
      isValidCsrfPair({ csrfCookie: "token", csrfHeader: undefined }),
    ).toBe(false);
  });

  it("rejects mismatched cookie and header values", () => {
    expect(isValidCsrfPair({ csrfCookie: "token", csrfHeader: "other" })).toBe(
      false,
    );
  });
});
