import { request } from "undici";
import { parse } from "tldts";

export async function domainAgeDaysFromRdap(
  hostname: string,
  timeoutMs = 5000,
): Promise<number | undefined> {
  const { domain } = parse(hostname);
  if (!domain) return undefined;
  const url = `https://rdap.org/domain/${domain}`;
  const res = await request(url, {
    headersTimeout: timeoutMs,
    bodyTimeout: timeoutMs,
  }).catch(() => null);
  if (!res || res.statusCode >= 400) return undefined;
  const json = (await res.body.json()) as {
    events?: Array<{
      eventAction?: string;
      eventDate?: string;
    }>;
  };
  const events = json?.events || [];
  const reg = events.find(
    (e) => e.eventAction === "registration" || e.eventAction === "registered",
  );
  if (!reg?.eventDate) return undefined;
  const regDate = new Date(reg.eventDate);
  const now = new Date();
  return Math.floor(
    (now.getTime() - regDate.getTime()) / (1000 * 60 * 60 * 24),
  );
}
