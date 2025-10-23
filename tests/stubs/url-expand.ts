export default function expandUrl(url: string, cb: (err: unknown, expanded?: string) => void): void {
  // Minimal stub: immediately echo back the provided URL.
  setImmediate(() => cb(null, url));
}
