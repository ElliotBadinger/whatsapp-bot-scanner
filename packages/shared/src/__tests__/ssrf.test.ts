jest.mock("node:dns/promises", () => ({
  lookup: jest.fn(),
}));

import { isPrivateHostname, isPrivateIp } from "../ssrf";
import type { LookupAddress } from "node:dns";

const { lookup } = jest.requireMock("node:dns/promises") as {
  lookup: jest.MockedFunction<
    (hostname: string, options: any) => Promise<LookupAddress[]>
  >;
};

describe("SSRF guards", () => {
  beforeEach(() => {
    lookup.mockReset();
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
    lookup.mockResolvedValueOnce([{ address: "192.168.1.5", family: 4 }]);
    await expect(isPrivateHostname("internal.test")).resolves.toBe(true);

    lookup.mockResolvedValueOnce([{ address: "8.8.8.8", family: 4 }]);
    await expect(isPrivateHostname("public.test")).resolves.toBe(false);
  });

  it("fails closed when dns lookup errors", async () => {
    lookup.mockRejectedValueOnce(new Error("dns failure"));
    await expect(isPrivateHostname("unknown.test")).resolves.toBe(true);
  });
});
