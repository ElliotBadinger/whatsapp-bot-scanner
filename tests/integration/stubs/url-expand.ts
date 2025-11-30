export default function urlExpand(
  url: string,
  callback: (err: unknown, expanded?: string) => void,
) {
  queueMicrotask(() => callback(null, url));
}
