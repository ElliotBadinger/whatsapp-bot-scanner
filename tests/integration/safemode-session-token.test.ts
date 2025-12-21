import { describe, expect, it } from 'vitest';
import {
  createSignedSessionToken,
  verifySignedSessionToken,
} from '../../SafeMode-web-app/lib/session-token';

describe('SafeMode session token', () => {
  it('creates and verifies a signed token', () => {
    const nowMs = Date.UTC(2025, 0, 1, 0, 0, 0);
    const secret = 'test-secret';

    const { token, claims } = createSignedSessionToken({
      secret,
      ttlSeconds: 60,
      nowMs,
    });

    expect(claims.exp).toBe(claims.iat + 60);

    const verified = verifySignedSessionToken(token, {
      secret,
      nowMs: nowMs + 1000,
    });

    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.claims).toEqual(claims);
    }
  });

  it('rejects invalid signatures', () => {
    const { token } = createSignedSessionToken({
      secret: 'test-secret',
      ttlSeconds: 60,
      nowMs: Date.UTC(2025, 0, 1, 0, 0, 0),
    });

    const [payload, signature] = token.split('.');
    const tampered = `${payload}.${signature.slice(0, -1)}x`;
    const verified = verifySignedSessionToken(tampered, {
      secret: 'test-secret',
      nowMs: Date.UTC(2025, 0, 1, 0, 0, 1),
    });

    expect(verified.ok).toBe(false);
    if (!verified.ok) {
      expect(verified.reason).toBe('invalid_signature');
    }
  });

  it('rejects expired tokens', () => {
    const nowMs = Date.UTC(2025, 0, 1, 0, 0, 0);
    const secret = 'test-secret';

    const { token } = createSignedSessionToken({
      secret,
      ttlSeconds: 2,
      nowMs,
    });

    const verified = verifySignedSessionToken(token, {
      secret,
      nowMs: nowMs + 5000,
    });

    expect(verified.ok).toBe(false);
    if (!verified.ok) {
      expect(verified.reason).toBe('expired');
    }
  });
});
