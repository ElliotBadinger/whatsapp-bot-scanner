export interface ScanJobData {
  url: string;
  urlHash: string;
  chatId: string;
  messageId: string;
  senderId?: string;
  timestamp?: number;
  isGroup?: boolean;
  manual?: boolean;
}

export interface ScanRequestQueue {
  add(name: string, data: ScanJobData, opts?: unknown): Promise<unknown>;
  close?(): Promise<void>;
}
