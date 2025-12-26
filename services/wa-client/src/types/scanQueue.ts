export type ScanRequestQueue = {
  add: (name: string, data: any, opts?: any) => Promise<any>;
  close?: () => Promise<void>;
};
