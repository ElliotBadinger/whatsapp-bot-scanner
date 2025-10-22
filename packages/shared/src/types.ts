export type Verdict = 'benign' | 'suspicious' | 'malicious';

export interface ScanRequest {
  chatId: string;
  messageId: string;
  senderIdHash?: string;
  url: string;
  timestamp: number;
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
  vt?: any;
  gsb?: boolean;
  domainAgeDays?: number;
  redirectChain?: string[];
  cacheTtl?: number;
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

