import dns from 'node:dns/promises';
import ipaddr from 'ipaddr.js';

const privateCidrs = [
  '10.0.0.0/8',
  '172.16.0.0/12',
  '192.168.0.0/16',
  '127.0.0.0/8',
  '169.254.0.0/16',
  '::1/128',
  'fc00::/7',
  'fe80::/10'
].map(c => ipaddr.parseCIDR(c));

export async function isPrivateHostname(hostname: string): Promise<boolean> {
  try {
    const addrs = await dns.lookup(hostname, { all: true, family: 0 });
    return addrs.some(a => isPrivateIp(a.address));
  } catch {
    return true; // fail closed
  }
}

export function isPrivateIp(ip: string): boolean {
  try {
    const addr = ipaddr.parse(ip);
    return privateCidrs.some(([range, prefix]) => {
      if (addr.kind() !== range.kind()) return false;
      return addr.match(range, prefix);
    });
  } catch {
    return true;
  }
}

