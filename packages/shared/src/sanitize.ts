export function sanitizeForLogging(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return value
      .replace(/[\r\n\t\f\v]+/g, ' ')
      .replace(/\u001b\[[0-9;]*m/g, '')
      .replace(/[\x00-\x1f\x7f]/g, '')
      .slice(0, 2048);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeForLogging(entry));
  }

  if (typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      sanitized[key] = sanitizeForLogging(entry);
    }
    return sanitized;
  }

  return value;
}

export function sanitizeInput(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  return value
    .toString()
    .trim()
    .replace(/[\u0000-\u001f\u007f]+/g, '')
    .replace(/[<>"'`]/g, '');
}
