import { request } from 'undici';
import { config } from '../config';

export interface UrlscanSubmissionOptions {
  visibility?: string;
  tags?: string[];
  referer?: string;
  callbackUrl?: string;
  customAgent?: string;
}

export interface UrlscanSubmissionResponse {
  uuid?: string;
  result?: string;
  api?: string;
  message?: string;
  submissionUrl?: string;
  visibility?: string;
  latencyMs?: number;
}

export interface UrlscanResult {
  task?: {
    uuid?: string;
    url?: string;
    visibility?: string;
    userAgent?: string;
    time?: string;
  };
  stats?: Record<string, unknown>;
  page?: Record<string, unknown>;
  lists?: Record<string, unknown>;
  submitter?: Record<string, unknown>;
  verdicts?: Record<string, unknown>;
}

function buildHeaders() {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (config.urlscan.apiKey) {
    headers['API-Key'] = config.urlscan.apiKey;
  }
  return headers;
}

export async function submitUrlscan(
  url: string,
  options: UrlscanSubmissionOptions = {}
): Promise<UrlscanSubmissionResponse> {
  if (!config.urlscan.enabled) {
    throw new Error('urlscan integration disabled');
  }
  if (!config.urlscan.apiKey) {
    throw new Error('urlscan API key missing');
  }

  const payload = {
    url,
    visibility: options.visibility || config.urlscan.visibility || 'private',
    tags: options.tags || config.urlscan.tags || [],
    referer: options.referer,
    callbackurl: options.callbackUrl || config.urlscan.callbackUrl || undefined,
    customagent: options.customAgent || 'wbscanner/urlscan',
  };

  const start = Date.now();
  const res = await request(`${config.urlscan.baseUrl}/api/v1/scan/`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(payload),
    headersTimeout: config.urlscan.submitTimeoutMs,
    bodyTimeout: config.urlscan.submitTimeoutMs,
  });

  if (res.statusCode === 429) {
    const err = new Error('urlscan quota exceeded');
    (err as any).code = 429;
    throw err;
  }
  if (res.statusCode >= 500) {
    const err = new Error(`urlscan error: ${res.statusCode}`);
    (err as any).statusCode = res.statusCode;
    throw err;
  }
  if (res.statusCode >= 400) {
    const errBody = await res.body.text();
    const err = new Error(`urlscan submission failed: ${res.statusCode} - ${errBody}`);
    (err as any).statusCode = res.statusCode;
    throw err;
  }

  const json: any = await res.body.json();
  return {
    uuid: json?.uuid,
    result: json?.result,
    api: json?.api,
    message: json?.message,
    submissionUrl: json?.submissionUrl,
    visibility: json?.visibility,
    latencyMs: Date.now() - start,
  };
}

export async function fetchUrlscanResult(uuid: string): Promise<UrlscanResult> {
  if (!config.urlscan.enabled) {
    throw new Error('urlscan integration disabled');
  }
  const res = await request(`${config.urlscan.baseUrl}/api/v1/result/${uuid}/`, {
    method: 'GET',
    headers: buildHeaders(),
    headersTimeout: config.urlscan.resultPollTimeoutMs,
    bodyTimeout: config.urlscan.resultPollTimeoutMs,
  });
  if (res.statusCode === 404) {
    const err = new Error('urlscan result not ready');
    (err as any).code = 404;
    throw err;
  }
  if (res.statusCode >= 500) {
    const err = new Error(`urlscan result error: ${res.statusCode}`);
    (err as any).statusCode = res.statusCode;
    throw err;
  }
  if (res.statusCode >= 400) {
    const err = new Error(`urlscan result failed: ${res.statusCode}`);
    (err as any).statusCode = res.statusCode;
    throw err;
  }
  const json: any = await res.body.json();
  return json;
}
