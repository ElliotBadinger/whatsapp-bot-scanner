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

export async function isPrivateHostname(hostname: string): Promise<boolean> {
  const lowerHostname = hostname.toLowerCase();

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

export async function assertSafeUrl(rawUrl: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Unsupported URL protocol: ${parsed.protocol}`);
  }

  const hostname = parsed.hostname;
  if (!hostname) {
    throw new Error("Missing hostname");
  }

  // Fast path: literal IPs.
  if (/^(\d+\.\d+\.\d+\.\d+|\[[0-9a-fA-F:]+\])$/.test(hostname)) {
    const ip = hostname.startsWith("[") ? hostname.slice(1, -1) : hostname;
    if (isPrivateIp(ip)) {
      throw new Error("Blocked private IP target");
    }
    return;
  }

  if (await isPrivateHostname(hostname)) {
    throw new Error("Blocked private hostname target");
  }
}
