import { buildServer } from '../index';
import { createMockQueue, createMockRedis } from '../../../../test-utils/setup';

const authHeader = { authorization: 'Bearer test-token' };

async function buildTestServer(dbQueryImpl?: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>) {
  const dbClient = {
    query: jest.fn(dbQueryImpl ?? (async () => ({ rows: [] }))),
  };
  const redisClient = createMockRedis();
  const queue = createMockQueue('scan-request');
  const { app } = await buildServer({
    dbClient,
    redisClient: redisClient as any,
    queue: queue as any,
  });
  return { app, dbClient, redisClient, queue };
}

describe('Security: Authentication & Authorization', () => {
  describe('Admin Endpoint Protection', () => {
    test('rejects requests without auth token', async () => {
      const { app } = await buildTestServer();
      try {
        const response = await app.inject({
          method: 'POST',
          url: '/overrides',
          payload: { url_hash: 'abc', status: 'deny' },
        });
        expect(response.statusCode).toBe(401);
      } finally {
        await app.close();
      }
    });

    test('rejects requests with invalid bearer format', async () => {
      const { app } = await buildTestServer();
      try {
        const response = await app.inject({
          method: 'POST',
          url: '/overrides',
          headers: { authorization: 'InvalidFormat token' },
          payload: { url_hash: 'abc', status: 'deny' },
        });
        expect(response.statusCode).toBe(401);
      } finally {
        await app.close();
      }
    });

    test('rejects requests with wrong token', async () => {
      const { app } = await buildTestServer();
      try {
        const response = await app.inject({
          method: 'POST',
          url: '/overrides',
          headers: { authorization: 'Bearer wrong-token' },
          payload: { url_hash: 'abc', status: 'deny' },
        });
        // Returns 401 (Unauthorized) for invalid tokens - acceptable security behavior
        expect(response.statusCode).toBe(401);
      } finally {
        await app.close();
      }
    });

    test('accepts valid auth token', async () => {
      const { app } = await buildTestServer();
      try {
        const response = await app.inject({
          method: 'POST',
          url: '/overrides',
          headers: authHeader,
          payload: { url_hash: 'abc', status: 'deny' },
        });
        expect(response.statusCode).toBe(201);
      } finally {
        await app.close();
      }
    });
  });
});

describe('Security: Input Validation', () => {
  describe('SQL Injection Prevention', () => {
    test('parameterizes queries - injection in url_hash is safe', async () => {
      const { app, dbClient } = await buildTestServer();
      try {
        const maliciousHash = "'; DROP TABLE overrides; --";
        const response = await app.inject({
          method: 'POST',
          url: '/overrides',
          headers: authHeader,
          payload: { url_hash: maliciousHash, status: 'deny' },
        });
        
        // Request should succeed (treated as literal string)
        expect(response.statusCode).toBe(201);
        
        // Verify the query was called with parameterized input
        expect(dbClient.query).toHaveBeenCalled();
        const callArgs = dbClient.query.mock.calls[0];
        // The malicious string should be in params, not concatenated in SQL
        expect(callArgs[1]).toContain(maliciousHash);
      } finally {
        await app.close();
      }
    });

    test('parameterizes queries - injection in status is safe', async () => {
      const { app } = await buildTestServer();
      try {
        const response = await app.inject({
          method: 'POST',
          url: '/overrides',
          headers: authHeader,
          payload: { url_hash: 'abc', status: "deny'; DROP TABLE--" },
        });
        
        // Invalid status should be rejected by validation
        expect(response.statusCode).toBe(400);
      } finally {
        await app.close();
      }
    });
  });

  describe('Path Traversal Prevention', () => {
    test('blocks path traversal in urlscan-artifacts', async () => {
      const { app } = await buildTestServer(async (sql: string) => {
        if (sql.includes('urlscan_screenshot_path')) {
          return { rows: [{ urlscan_screenshot_path: '../../../etc/passwd' }] };
        }
        return { rows: [] };
      });
      
      const validHash = 'a'.repeat(64);
      try {
        const response = await app.inject({
          method: 'GET',
          url: `/scans/${validHash}/urlscan-artifacts/screenshot`,
          headers: authHeader,
        });
        
        expect(response.statusCode).toBe(403);
      } finally {
        await app.close();
      }
    });

    test('blocks absolute path outside storage', async () => {
      const { app } = await buildTestServer(async (sql: string) => {
        if (sql.includes('urlscan_screenshot_path')) {
          return { rows: [{ urlscan_screenshot_path: '/tmp/malicious.png' }] };
        }
        return { rows: [] };
      });
      
      const validHash = 'b'.repeat(64);
      try {
        const response = await app.inject({
          method: 'GET',
          url: `/scans/${validHash}/urlscan-artifacts/screenshot`,
          headers: authHeader,
        });
        
        expect(response.statusCode).toBe(403);
      } finally {
        await app.close();
      }
    });
  });

  describe('URL Validation', () => {
    test('rejects javascript: protocol URLs', async () => {
      const { app } = await buildTestServer();
      try {
        const response = await app.inject({
          method: 'POST',
          url: '/rescan',
          headers: authHeader,
          payload: { url: 'javascript:alert(1)' },
        });
        
        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.payload);
        expect(body.error).toBe('invalid_url');
      } finally {
        await app.close();
      }
    });

    test('rejects data: protocol URLs', async () => {
      const { app } = await buildTestServer();
      try {
        const response = await app.inject({
          method: 'POST',
          url: '/rescan',
          headers: authHeader,
          payload: { url: 'data:text/html,<script>alert(1)</script>' },
        });
        
        expect(response.statusCode).toBe(400);
      } finally {
        await app.close();
      }
    });

    test('rejects file: protocol URLs', async () => {
      const { app } = await buildTestServer();
      try {
        const response = await app.inject({
          method: 'POST',
          url: '/rescan',
          headers: authHeader,
          payload: { url: 'file:///etc/passwd' },
        });
        
        expect(response.statusCode).toBe(400);
      } finally {
        await app.close();
      }
    });

    test('accepts valid HTTPS URLs', async () => {
      const { app, queue } = await buildTestServer(async (sql: string) => {
        if (sql.startsWith('SELECT chat_id')) {
          return { rows: [{ chat_id: 'chat-1', message_id: 'msg-1' }] };
        }
        return { rows: [] };
      });
      
      try {
        const response = await app.inject({
          method: 'POST',
          url: '/rescan',
          headers: authHeader,
          payload: { url: 'https://example.com/safe' },
        });
        
        expect(response.statusCode).toBe(200);
        expect(queue.add).toHaveBeenCalled();
      } finally {
        await app.close();
      }
    });
  });

  describe('Parameter Validation', () => {
    test('rejects invalid urlHash format', async () => {
      const { app } = await buildTestServer();
      try {
        const response = await app.inject({
          method: 'GET',
          url: '/scans/invalid-hash/urlscan-artifacts/screenshot',
          headers: authHeader,
        });
        
        expect(response.statusCode).toBe(400);
      } finally {
        await app.close();
      }
    });

    test('rejects invalid artifact type', async () => {
      const { app } = await buildTestServer();
      const validHash = 'c'.repeat(64);
      try {
        const response = await app.inject({
          method: 'GET',
          url: `/scans/${validHash}/urlscan-artifacts/malicious-type`,
          headers: authHeader,
        });
        
        expect(response.statusCode).toBe(400);
      } finally {
        await app.close();
      }
    });

    test('rejects override with invalid status enum', async () => {
      const { app } = await buildTestServer();
      try {
        const response = await app.inject({
          method: 'POST',
          url: '/overrides',
          headers: authHeader,
          payload: { url_hash: 'abc', status: 'invalid-status' },
        });
        
        expect(response.statusCode).toBe(400);
      } finally {
        await app.close();
      }
    });
  });
});

describe('Security: Error Message Safety', () => {
  test('returns 500 on internal errors without crashing', async () => {
    const { app } = await buildTestServer(async () => {
      throw new Error('Database query failed');
    });
    
    try {
      const response = await app.inject({
        method: 'GET',
        url: '/status',
        headers: authHeader,
      });
      
      // Verify error handling doesn't crash the server
      expect(response.statusCode).toBe(500);
    } finally {
      await app.close();
    }
  });

  test('healthz endpoint is always accessible', async () => {
    const { app } = await buildTestServer();
    try {
      const response = await app.inject({
        method: 'GET',
        url: '/healthz',
      });
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual({ ok: true });
    } finally {
      await app.close();
    }
  });
});

describe('Security: Rate Limiting', () => {
  test('enforces rate limits on rescan endpoint', async () => {
    // rescan limit is 10 points per minute (see packages/shared/src/rate-limiter.ts)
    const limit = 10;
    const { app, queue } = await buildTestServer(async (sql: string) => {
      // Mock DB for rescan checks if needed (though redis checks come first)
      if (sql.startsWith('SELECT chat_id')) {
        return { rows: [] };
      }
      return { rows: [] };
    });

    try {
      // Send requests up to the limit
      for (let i = 0; i < limit; i++) {
        const response = await app.inject({
          method: 'POST',
          url: '/rescan',
          headers: authHeader,
          payload: { url: `https://example.com/page${i}` },
        });
        // Should be successful (200) or validation error (400) but NOT 429
        // 200 is expected because we use valid URLs
        expect(response.statusCode).not.toBe(429);
      }

      // The next request should be rate limited
      const response = await app.inject({
        method: 'POST',
        url: '/rescan',
        headers: authHeader,
        payload: { url: 'https://example.com/blocked' },
      });

      expect(response.statusCode).toBe(429);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('too_many_requests');

    } finally {
      await app.close();
    }
  });
});
