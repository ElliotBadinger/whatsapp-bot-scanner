declare module "url-expand" {
  type Callback = (err: unknown, expanded?: string) => void;
  export default function expandUrl(url: string, cb: Callback): void;
}
