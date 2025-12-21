import dns from "node:dns/promises";
import ipaddr from "ipaddr.js";

const privateCidrs = [
  "0.0.0.0/8", // Current network (includes 0.0.0.0)
  "10.0.0.0/8", // Private network
  "172.16.0.0/12", // Private network
  "192.168.0.0/16", // Private network
  "127.0.0.0/8", // Loopback
  "169.254.0.0/16", // Link-local
  "::/128", // IPv6 Unspecified
  "::1/128", // IPv6 Loopback
  "fc00::/7", // Unique Local
  "fe80::/10", // Link-local
].map((c) => ipaddr.parseCIDR(c));

const BLOCKED_HOSTNAMES = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::",
  "::1",
  "internal",
  "metadata",
  "169.254.169.254",
];

export async function isPrivateHostname(hostname: string): Promise<boolean> {
  const lowerHostname = hostname.toLowerCase();
  // URL hostnames for IP literals can be bracketed (e.g. `[::1]`).
  // If the bracketed value isn't an IP literal, fail closed.
  const bracketMatch = /^\[(.*)\]$/.exec(lowerHostname);
  const normalizedHost = bracketMatch ? bracketMatch[1] : lowerHostname;

  if (bracketMatch && !ipaddr.isValid(normalizedHost)) {
    return true;
  }

  // Check blocked hostnames first
  if (BLOCKED_HOSTNAMES.includes(normalizedHost)) {
    return true;
  }

  // If this is already an IP literal, avoid DNS and apply the same policy.
  if (ipaddr.isValid(normalizedHost)) {
    return isPrivateIp(normalizedHost);
  }

  try {
    const [a, aaaa] = await Promise.allSettled([
      dns.resolve4(normalizedHost),
      dns.resolve6(normalizedHost),
    ]);

    const ips = [
      ...(a.status === "fulfilled" ? a.value : []),
      ...(aaaa.status === "fulfilled" ? aaaa.value : []),
    ];

    if (ips.length > 0) {
      return ips.some(isPrivateIp);
    }

    const addrs = await dns.lookup(normalizedHost, { all: true, family: 0 });
    if (addrs.length === 0) return true;
    return addrs.some((addr) => isPrivateIp(addr.address));
  } catch {
    return true; // fail closed
  }
}

export function isPrivateIp(ip: string): boolean {
  try {
    let addr = ipaddr.parse(ip);

    // Handle IPv4-mapped IPv6 addresses (e.g., ::ffff:127.0.0.1)
    if (addr.kind() === "ipv6") {
      const ipv6 = addr as ipaddr.IPv6;
      if (ipv6.isIPv4MappedAddress()) {
        addr = ipv6.toIPv4Address();
      }
    }

    return privateCidrs.some(([range, prefix]) => {
      if (addr.kind() !== range.kind()) return false;
      return addr.match(range, prefix);
    });
  } catch {
    return true;
  }
}
