declare module 'url-expand' {
  type ExpandCallback = (error: unknown, expanded?: string) => void;
  function expand(url: string, callback: ExpandCallback): void;
  export default expand;
}
