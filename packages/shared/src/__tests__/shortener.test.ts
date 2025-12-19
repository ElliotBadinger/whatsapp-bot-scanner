jest.mock("undici", () => ({
  request: jest.fn(),
  fetch: jest.fn(),
}));

jest.mock("../ssrf", () => ({
  isPrivateHostname: jest.fn().mockResolvedValue(false),
}));

import {
  isKnownShortener,
  registerAdditionalShorteners,
  resolveShortener,
} from "../url-shortener";
import { config } from "../config";
import type { fetch as fetchType, request as requestType } from "undici";

const { request, fetch } = jest.requireMock("undici") as {
  request: jest.MockedFunction<typeof requestType>;
  fetch: jest.MockedFunction<typeof fetchType>;
};
const { isPrivateHostname } = jest.requireMock("../ssrf") as {
  isPrivateHostname: jest.Mock;
};

const makeResponse = (options: {
  status: number;
  location?: string;
  contentLength?: number;
}) => ({
  status: options.status,
  headers: {
    get: (name: string) => {
      if (name === "location") return options.location ?? null;
      if (name === "content-length" && options.contentLength !== undefined) {
        return String(options.contentLength);
      }
      return null;
    },
  },
  body: { cancel: jest.fn() },
});

beforeEach(() => {
  request.mockReset();
  fetch.mockReset();
  (isPrivateHostname as jest.Mock).mockReset();
  (isPrivateHostname as jest.Mock).mockResolvedValue(false);
  config.shortener.unshortenEndpoint = "https://unshorten.test";
  config.shortener.unshortenRetries = 1;
  config.orchestrator.expansion.maxRedirects = 2;
  config.orchestrator.expansion.timeoutMs = 1000;
  config.orchestrator.expansion.maxContentLength = 1024 * 1024;
});

describe("shortener detection", () => {
  it("recognises common shorteners", () => {
    expect(isKnownShortener("bit.ly")).toBe(true);
    expect(isKnownShortener("t.co")).toBe(true);
  });

  it("ignores non-shortener domains", () => {
    expect(isKnownShortener("example.com")).toBe(false);
  });
});

describe("shortener expansion", () => {
  it("registers additional shorteners", () => {
    registerAdditionalShorteners(["my.short"]);
    expect(isKnownShortener("my.short")).toBe(true);
  });

  it("returns original when url is invalid", async () => {
    const result = await resolveShortener("not-a-url");
    expect(result).toEqual({
      finalUrl: "not-a-url",
      provider: "original",
      chain: [],
      wasShortened: false,
      expanded: false,
    });
  });

  it("uses unshorten.me when available", async () => {
    request.mockResolvedValue({
      statusCode: 200,
      body: {
        json: async () => ({
          resolved_url: "https://example.com/final",
          success: true,
        }),
      },
    } as any);

    const result = await resolveShortener("https://bit.ly/abc");
    expect(result.provider).toBe("unshorten_me");
    expect(result.finalUrl).toBe("https://example.com/final");
    expect(result.chain).toEqual([
      "https://bit.ly/abc",
      "https://example.com/final",
    ]);
    expect(result.expanded).toBe(true);
  });

  it("falls back to direct expansion on unshorten failure", async () => {
    request.mockResolvedValue({
      statusCode: 500,
      body: { json: async () => ({}) },
    } as any);

    fetch
      .mockResolvedValueOnce(
        makeResponse({ status: 302, location: "https://final.test" }) as any,
      )
      .mockResolvedValueOnce(makeResponse({ status: 200 }) as any);

    const result = await resolveShortener("https://t.co/abc");
    expect(result.provider).toBe("direct");
    expect(result.finalUrl).toBe("https://final.test/");
    expect(result.chain).toEqual(["https://t.co/abc", "https://final.test/"]);
  });

  it("returns ssrf-blocked when private host detected", async () => {
    request.mockResolvedValue({
      statusCode: 404,
      body: { json: async () => ({}) },
    } as any);
    (isPrivateHostname as jest.Mock).mockResolvedValueOnce(true);

    const result = await resolveShortener("https://bit.ly/private");
    expect(result.provider).toBe("original");
    expect(result.reason).toBe("ssrf-blocked");
    expect(result.wasShortened).toBe(true);
  });

  it("returns expansion failed when direct expansion rejects", async () => {
    request.mockResolvedValue({
      statusCode: 404,
      body: { json: async () => ({}) },
    } as any);
    fetch.mockResolvedValueOnce(makeResponse({ status: 404 }) as any);

    const result = await resolveShortener("https://tinyurl.com/abc");
    expect(result.provider).toBe("original");
    expect(result.reason).toBe("expansion-failed");
    expect(result.error).toBe("Service unavailable");
  });
});
