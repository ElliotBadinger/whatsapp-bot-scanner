export type Verdict = 'benign' | 'suspicious' | 'malicious';

export interface ScanRequest {
  chatId?: string;
  messageId?: string;
  senderIdHash?: string;
  url: string;
  timestamp?: number;
}

export interface ScanResult {
  chatId: string;
  messageId: string;
  url: string;
  normalizedUrl: string;
  urlHash: string;
  verdict: Verdict;
  score: number;
  reasons: string[];
  override?: {
    status: 'allow' | 'deny';
    reason?: string | null;
  };
  vt?: unknown;
  gsb?: { matches: unknown[] } | boolean;
  phishtank?: unknown;
  urlhaus?: unknown;
  urlscan?: {
    status?: string;
    uuid?: string;
  };
  whois?: {
    source?: 'rdap' | 'whoisxml';
    ageDays?: number;
    registrar?: string;
  };
  domainAgeDays?: number;
  redirectChain?: string[];
  cacheTtl?: number;
  ttlLevel?: Verdict;
  shortener?: {
    provider: string;
    chain: string[];
  };
  finalUrlMismatch?: boolean;
}

export interface GroupSettings {
  notify_admins?: boolean;
  throttles?: {
    per_group_cooldown_seconds?: number;
    global_per_minute?: number;
  };
  quiet_hours?: string; // e.g., "22-07"
  language?: string; // e.g., "en"
}
