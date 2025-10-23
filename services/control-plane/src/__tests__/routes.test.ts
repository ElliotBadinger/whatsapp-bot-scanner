process.env.NODE_ENV = 'test';
process.env.CONTROL_PLANE_API_TOKEN = 'test-token';

import type { FastifyInstance } from 'fastify';
import { buildServer } from '../index';

describe('control-plane routes', () => {
  let pgClient: { connect: jest.Mock; query: jest.Mock };
  let app: FastifyInstance;

  beforeEach(async () => {
    pgClient = {
      connect: jest.fn(),
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };
    const { app: fastifyApp } = await buildServer({ pgClient } as any);
    app = fastifyApp;
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  it('rejects unauthorized requests', async () => {
    const response = await app.inject({ method: 'GET', url: '/status' });
    expect(response.statusCode).toBe(401);
  });

  it('returns status metrics when authorized', async () => {
    pgClient.query.mockResolvedValueOnce({ rows: [{ scans: '3', malicious: '1' }] });
    const response = await app.inject({
      method: 'GET',
      url: '/status',
      headers: { authorization: 'Bearer test-token' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ scans: 3, malicious: 1 });
  });

  it('creates overrides via API', async () => {
    pgClient.query.mockResolvedValue({ rows: [] });
    const response = await app.inject({
      method: 'POST',
      url: '/overrides',
      headers: { authorization: 'Bearer test-token' },
      payload: { status: 'allow', reason: 'testing' },
    });
    expect(response.statusCode).toBe(201);
    expect(pgClient.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO overrides'),
      expect.arrayContaining([null, null, 'allow', 'global', null, 'admin', 'testing', null])
    );
  });

  it('serves stored urlscan artifact bytes', async () => {
    pgClient.query.mockResolvedValueOnce({ rows: [{ content: Buffer.from('hello'), content_type: 'text/plain' }] });
    const response = await app.inject({
      method: 'GET',
      url: '/scans/hash-123/urlscan-artifacts/screenshot',
      headers: { authorization: 'Bearer test-token' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('text/plain');
    expect(response.body).toBe('hello');
  });

  it('returns 404 when artifact missing', async () => {
    pgClient.query.mockResolvedValueOnce({ rows: [] });
    const response = await app.inject({
      method: 'GET',
      url: '/scans/missing/urlscan-artifacts/screenshot',
      headers: { authorization: 'Bearer test-token' },
    });
    expect(response.statusCode).toBe(404);
  });
});
