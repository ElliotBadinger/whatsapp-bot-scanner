import dns from "node:dns/promises";
import ipaddr from "ipaddr.js";

const privateCidrs = [
  "0.0.0.0/8", // NOSONAR - reserved current network range
  "10.0.0.0/8", // NOSONAR - RFC1918 private range
  "172.16.0.0/12", // NOSONAR - RFC1918 private range
  "192.168.0.0/16", // NOSONAR - RFC1918 private range
  "127.0.0.0/8", // NOSONAR - loopback range
  "169.254.0.0/16", // NOSONAR - link-local range
  "::/128", // NOSONAR - IPv6 unspecified
  "::1/128", // NOSONAR - IPv6 loopback
  "fc00::/7", // NOSONAR - IPv6 unique local range
  "fe80::/10", // NOSONAR - IPv6 link-local range
].map((c) => ipaddr.parseCIDR(c));

const BLOCKED_HOSTNAMES = [
  "localhost", // NOSONAR - local-only hostname
  "127.0.0.1", // NOSONAR - loopback
  "0.0.0.0", // NOSONAR - invalid/unspecified
  "::1", // NOSONAR - IPv6 loopback
  "internal", // NOSONAR - internal keyword
  "metadata", // NOSONAR - metadata keyword
  "169.254.169.254", // NOSONAR - cloud metadata IP
];

function parseAllowlist(): string[] {
  const raw =
    process.env.WA_SCAN_ALLOWLIST_HOSTNAMES ||
    process.env.WA_SSRF_ALLOWLIST_HOSTNAMES ||
    "";
  return raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

function isAllowlistedHostname(hostname: string): boolean {
  const allowlist = parseAllowlist();
  if (allowlist.length === 0) return false;
  return allowlist.some(
    (entry) => hostname === entry || hostname.endsWith(`.${entry}`),
  );
}

export async function isPrivateHostname(hostname: string): Promise<boolean> {
  const lowerHostname = hostname.toLowerCase();

  if (isAllowlistedHostname(lowerHostname)) {
    return false;
  }

  // Check blocked hostnames first
  if (BLOCKED_HOSTNAMES.includes(lowerHostname)) {
    return true;
  }

  try {
    const results = await Promise.allSettled([
      dns.resolve4(hostname),
      dns.resolve6(hostname),
    ]);

    // If all failed, we consider it a failure and fail closed
    if (results.every((r) => r.status === "rejected")) {
      throw new Error("DNS resolution failed");
    }

    const addrs: string[] = [];
    for (const res of results) {
      if (res.status === "fulfilled") {
        addrs.push(...res.value);
      }
    }

    return addrs.some((ip) => isPrivateIp(ip));
  } catch {
    return true; // fail closed
  }
}

export function isPrivateIp(ip: string): boolean {
  try {
    let addr = ipaddr.parse(ip);

    // Handle IPv4-mapped IPv6 addresses (e.g., ::ffff:127.0.0.1)
    if (addr.kind() === "ipv6" && (addr as ipaddr.IPv6).isIPv4MappedAddress()) {
      addr = (addr as ipaddr.IPv6).toIPv4Address();
    }

    return privateCidrs.some(([range, prefix]) => {
      if (addr.kind() !== range.kind()) return false;
      return addr.match(range, prefix);
    });
  } catch {
    return true;
  }
}
