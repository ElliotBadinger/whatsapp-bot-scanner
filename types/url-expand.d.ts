declare module 'url-expand' {
  import type { RequestInit, Response } from 'undici';

  export interface ExpandOptions {
    fetch: (input: string | URL, init?: RequestInit) => Promise<Response>;
    maxRedirects?: number;
    timeoutMs?: number;
  }

  export interface ExpandResult {
    url: string;
    redirects?: string[];
  }

  export function expand(url: string, options: ExpandOptions): Promise<ExpandResult>;

  export default expand;
}
