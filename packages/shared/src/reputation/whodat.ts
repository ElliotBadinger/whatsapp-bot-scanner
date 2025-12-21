import { request } from "undici";
import { config } from "../config";
import { metrics } from "../metrics";
import { FeatureDisabledError } from "../errors";
import { logger } from "../log";
import { HttpError } from "../http-errors";

export interface WhoDatRecord {
  domainName?: string;
  createdDate?: string;
  updatedDate?: string;
  expiresDate?: string;
  registrarName?: string;
  estimatedDomainAgeDays?: number;
  nameServers?: string[];
  status?: string[];
}

export interface WhoDatResponse {
  record?: WhoDatRecord;
}

/**
 * Response structure from the Lissy93/who-dat API
 * @see https://github.com/Lissy93/who-dat
 */
interface WhoDatApiResponse {
  domain?: {
    id?: string;
    domain?: string;
    punycode?: string;
    name?: string;
    extension?: string;
    whois_server?: string;
    status?: string[];
    name_servers?: string[];
    created_date?: string;
    created_date_in_time?: string;
    updated_date?: string;
    updated_date_in_time?: string;
    expiration_date?: string;
    expiration_date_in_time?: string;
  };
  registrar?: {
    id?: string;
    name?: string;
    phone?: string;
    email?: string;
    referral_url?: string;
  };
  registrant?: {
    name?: string;
    organization?: string;
    country?: string;
    email?: string;
  };
  administrative?: {
    name?: string;
    organization?: string;
    email?: string;
  };
  technical?: {
    name?: string;
    organization?: string;
    email?: string;
  };
  error?: string;
}

/**
 * Query the self-hosted who-dat WHOIS service (Lissy93/who-dat)
 * @see https://github.com/Lissy93/who-dat
 * @param domain - Domain name to query
 * @returns WHOIS record information
 */
export async function whoDatLookup(domain: string): Promise<WhoDatResponse> {
  if (!config.whodat.enabled) {
    throw new FeatureDisabledError("whodat", "Who-dat WHOIS service disabled");
  }

  // who-dat API uses /{domain} endpoint directly
  const url = new URL(`${config.whodat.baseUrl}/${encodeURIComponent(domain)}`);

  metrics.whoisRequests.inc();
  const start = Date.now();

  try {
    const res = await request(url.toString(), {
      method: "GET",
      headersTimeout: config.whodat.timeoutMs,
      bodyTimeout: config.whodat.timeoutMs,
    });

    const latency = Date.now() - start;

    if (res.statusCode === 404) {
      metrics.whoisResults.labels("not_found").inc();
      logger.debug({ domain }, "Who-dat: domain not found");
      return { record: undefined };
    }

    if (res.statusCode >= 500) {
      metrics.whoisResults.labels("error").inc();
      const err = new Error(
        `Who-dat service error: ${res.statusCode}`,
      ) as HttpError;
      err.statusCode = res.statusCode;
      throw err;
    }

    if (res.statusCode >= 400) {
      metrics.whoisResults.labels("error").inc();
      const err = new Error(
        `Who-dat request failed: ${res.statusCode}`,
      ) as HttpError;
      err.statusCode = res.statusCode;
      throw err;
    }

    const json = (await res.body.json()) as WhoDatApiResponse;

    // Check for API error response
    if (json.error) {
      metrics.whoisResults.labels("error").inc();
      logger.warn({ domain, error: json.error }, "Who-dat API returned error");
      return { record: undefined };
    }

    metrics.whoisResults.labels("success").inc();

    // Parse creation date and calculate domain age
    // Prefer the ISO timestamp if available
    const createdDate =
      json.domain?.created_date_in_time || json.domain?.created_date;
    let ageDays: number | undefined;

    if (createdDate) {
      const created = new Date(createdDate);
      if (!Number.isNaN(created.getTime())) {
        const now = Date.now();
        ageDays = Math.floor((now - created.getTime()) / (1000 * 60 * 60 * 24));
      }
    }

    logger.debug({ domain, latency, ageDays }, "Who-dat lookup completed");

    return {
      record: {
        domainName: json.domain?.domain || domain,
        createdDate: createdDate,
        updatedDate:
          json.domain?.updated_date_in_time || json.domain?.updated_date,
        expiresDate:
          json.domain?.expiration_date_in_time || json.domain?.expiration_date,
        registrarName: json.registrar?.name,
        estimatedDomainAgeDays: ageDays,
        nameServers: json.domain?.name_servers || [],
        status: json.domain?.status || [],
      },
    };
  } catch (err) {
    metrics.whoisResults.labels("error").inc();
    logger.warn({ err, domain }, "Who-dat lookup failed");
    throw err;
  }
}
