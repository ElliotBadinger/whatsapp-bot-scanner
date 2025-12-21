export const CSRF_COOKIE_NAME = "safemode_csrf";
export const CSRF_HEADER_NAME = "x-csrf-token";

export function isValidCsrfPair(options: {
  csrfCookie: string | undefined;
  csrfHeader: string | undefined;
}): boolean {
  const csrfCookie = (options.csrfCookie ?? "").trim();
  const csrfHeader = (options.csrfHeader ?? "").trim();
  if (!csrfCookie || !csrfHeader) return false;
  return csrfCookie === csrfHeader;
}
