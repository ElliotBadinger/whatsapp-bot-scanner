// Shared error types for HTTP operations
export interface HttpError extends Error {
  statusCode?: number;
  code?: number | string;
  details?: unknown;
}

export function createHttpError(
  message: string,
  statusCode?: number,
): HttpError {
  const error = new Error(message) as HttpError;
  if (statusCode !== undefined) {
    error.statusCode = statusCode;
  }
  return error;
}
