import {
  ApiError,
  muteGroup,
  rescanUrl,
  unmuteGroup,
} from "../../SafeMode-web-app/lib/api";

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

describe("SafeMode-web-app API helpers", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("POSTs /api/rescan with JSON body", async () => {
    const fetchMock = jest.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse({
          ok: true,
          urlHash: "hash123",
          jobId: "job-1",
        }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await rescanUrl("https://example.com");
    expect(result).toEqual({ ok: true, urlHash: "hash123", jobId: "job-1" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe("/api/rescan");

    expect(init?.method).toBe("POST");
    expect(init?.cache).toBe("no-store");
    expect(init?.body).toBe(JSON.stringify({ url: "https://example.com" }));

    const headers = new Headers(init?.headers as HeadersInit | undefined);
    expect(headers.get("accept")).toBe("application/json");
    expect(headers.get("content-type")).toBe("application/json");
  });

  it("POSTs /api/groups/:chatId/mute with encoded chatId", async () => {
    const fetchMock = jest.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse({ ok: true, muted_until: "2025-12-21T00:00:00.000Z" }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await muteGroup("group/one");
    expect(result.ok).toBe(true);
    expect(result.muted_until).toBe("2025-12-21T00:00:00.000Z");

    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe("/api/groups/group%2Fone/mute");
    expect(init?.method).toBe("POST");
    expect(init?.cache).toBe("no-store");
    const headers = new Headers(init?.headers as HeadersInit | undefined);
    expect(headers.get("accept")).toBe("application/json");
  });

  it("POSTs /api/groups/:chatId/unmute with encoded chatId", async () => {
    const fetchMock = jest.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse({ ok: true }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await unmuteGroup("group/one");
    expect(result).toEqual({ ok: true });

    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe("/api/groups/group%2Fone/unmute");
    expect(init?.method).toBe("POST");
    expect(init?.cache).toBe("no-store");
    const headers = new Headers(init?.headers as HeadersInit | undefined);
    expect(headers.get("accept")).toBe("application/json");
  });

  it("throws ApiError with code when response is JSON error", async () => {
    const fetchMock = jest.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse({ error: "invalid_url" }, 400),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    let thrown: unknown;
    try {
      await rescanUrl("https://example.com");
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(ApiError);
    expect(thrown).toMatchObject({
      name: "ApiError",
      status: 400,
      code: "invalid_url",
    });
  });
});
