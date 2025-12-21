jest.mock("node:dns/promises", () => ({
  lookup: jest.fn(),
  resolve4: jest.fn(),
  resolve6: jest.fn(),
}));

import { isPrivateHostname, isPrivateIp } from "../ssrf";
import type { LookupAddress } from "node:dns";

const { lookup } = jest.requireMock("node:dns/promises") as {
  lookup: jest.MockedFunction<
    (hostname: string, options: any) => Promise<LookupAddress[]>
  >;
};

const { resolve4, resolve6 } = jest.requireMock("node:dns/promises") as {
  resolve4: jest.MockedFunction<(hostname: string) => Promise<string[]>>;
  resolve6: jest.MockedFunction<(hostname: string) => Promise<string[]>>;
};

describe("SSRF guards", () => {
  beforeEach(() => {
    lookup.mockReset();
    resolve4.mockReset();
    resolve6.mockReset();
  });

  it("detects private ipv4 ranges", () => {
    expect(isPrivateIp("10.0.0.1")).toBe(true);
    expect(isPrivateIp("172.16.5.2")).toBe(true);
    expect(isPrivateIp("192.168.1.10")).toBe(true);
    expect(isPrivateIp("8.8.8.8")).toBe(false);
  });

  it("detects private ipv6 and loopback addresses", () => {
    expect(isPrivateIp("::1")).toBe(true);
    expect(isPrivateIp("fc00::1")).toBe(true);
    expect(isPrivateIp("2001:4860:4860::8888")).toBe(false);
  });

  it("flags private hostnames based on dns lookup", async () => {
    resolve4.mockResolvedValueOnce(["192.168.1.5"]);
    resolve6.mockResolvedValueOnce([]);
    await expect(isPrivateHostname("internal.test")).resolves.toBe(true);

    resolve4.mockResolvedValueOnce(["8.8.8.8"]);
    resolve6.mockResolvedValueOnce([]);
    await expect(isPrivateHostname("public.test")).resolves.toBe(false);
  });

  it("fails closed when dns lookup errors", async () => {
    resolve4.mockRejectedValueOnce(new Error("dns failure"));
    resolve6.mockRejectedValueOnce(new Error("dns failure"));
    lookup.mockRejectedValueOnce(new Error("dns failure"));
    await expect(isPrivateHostname("unknown.test")).resolves.toBe(true);
  });

  it("blocks bracketed ipv6 literals", async () => {
    await expect(isPrivateHostname("[::1]")).resolves.toBe(true);
    expect(resolve4).not.toHaveBeenCalled();
    expect(resolve6).not.toHaveBeenCalled();
    expect(lookup).not.toHaveBeenCalled();
  });
});
