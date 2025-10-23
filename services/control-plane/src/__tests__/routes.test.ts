process.env.NODE_ENV = 'test';
process.env.CONTROL_PLANE_API_TOKEN = 'test-token';
process.env.CONTROL_PLANE_CSRF_TOKEN = 'test-token';

jest.mock('url-expand', () => ({
  __esModule: true,
  default: jest.fn(async (url: string) => url),
}), { virtual: true });

jest.mock('bottleneck', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    schedule: jest.fn(async <T>(fn: () => Promise<T> | T) => fn()),
    on: jest.fn(),
    currentReservoir: jest.fn(async () => 1),
  })),
}), { virtual: true });

jest.mock('confusables', () => ({
  __esModule: true,
  default: jest.fn((value: string) => value),
}), { virtual: true });

import type { FastifyInstance } from 'fastify';
import fs from 'node:fs/promises';
import path from 'node:path';
import { buildServer } from '../index';

jest.mock('url-expand', () => ({ __esModule: true, default: jest.fn(async (url: string) => url) }), { virtual: true });
jest.mock('confusables', () => ({ __esModule: true, default: (input: string) => input }), { virtual: true });
jest.mock('bottleneck', () => ({
  __esModule: true,
  default: class BottleneckMock {
    on(): void {
      // no-op for tests
    }
    async currentReservoir(): Promise<number> {
      return 1;
    }
    schedule<T>(fn: (...args: any[]) => T, ...params: any[]): Promise<T> {
      return Promise.resolve(fn(...params));
    }
  }
}), { virtual: true });

describe('control-plane routes', () => {
  let pgClient: { connect: jest.Mock; query: jest.Mock };
  let app: FastifyInstance;
  let redisClient: { del: jest.Mock };
  let queue: { add: jest.Mock };

  beforeEach(async () => {
    pgClient = {
      connect: jest.fn(),
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };
    redisClient = { del: jest.fn().mockResolvedValue(1) } as any;
    queue = { add: jest.fn().mockResolvedValue({ id: 'job-123' }) } as any;
    const { app: fastifyApp } = await buildServer({ pgClient, redisClient, queue } as any);
    app = fastifyApp;
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  it('invalidates caches and enqueues rescan job', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/rescan',
      payload: { url: 'https://example.com/test?utm_source=newsletter' },
      headers: { authorization: 'Bearer test-token', 'x-csrf-token': 'test-token', 'content-type': 'application/json' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toEqual({ ok: true, urlHash: expect.any(String), jobId: 'job-123' });

    const hashRegex = /^[0-9a-f]{64}$/;
    expect(body.urlHash).toMatch(hashRegex);
    expect(redisClient.del).toHaveBeenCalledTimes(8);
    expect(redisClient.del).toHaveBeenCalledWith(`scan:${body.urlHash}`);
    expect(redisClient.del).toHaveBeenCalledWith(`url:verdict:${body.urlHash}`);
    expect(redisClient.del).toHaveBeenCalledWith(`url:analysis:${body.urlHash}:vt`);
    expect(redisClient.del).toHaveBeenCalledWith(`url:analysis:${body.urlHash}:gsb`);
    expect(redisClient.del).toHaveBeenCalledWith(`url:analysis:${body.urlHash}:whois`);
    expect(redisClient.del).toHaveBeenCalledWith(`url:analysis:${body.urlHash}:phishtank`);
    expect(redisClient.del).toHaveBeenCalledWith(`url:analysis:${body.urlHash}:urlhaus`);
    expect(redisClient.del).toHaveBeenCalledWith(`url:shortener:${body.urlHash}`);
    expect(queue.add).toHaveBeenCalledWith(
      'rescan',
      { url: expect.stringMatching(/^https:\/\/example\.com\/test\/?$/), urlHash: body.urlHash },
      expect.objectContaining({ removeOnComplete: true, removeOnFail: 100, priority: 1 })
    );
  });

  it('rejects rescan requests targeting internal hosts', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/rescan',
      payload: { url: 'http://127.0.0.1/secret' },
      headers: { authorization: 'Bearer test-token', 'x-csrf-token': 'test-token', 'content-type': 'application/json' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'disallowed_host' });
  });

  it('fails to start when control plane token missing', async () => {
    delete process.env.CONTROL_PLANE_API_TOKEN;
    let buildPromise: Promise<unknown> | undefined;

    jest.isolateModules(() => {
      const mod = require('../index') as typeof import('../index');
      const fakePg = { connect: jest.fn(), query: jest.fn() } as any;
      buildPromise = mod.buildServer({ pgClient: fakePg });
    });

    expect(buildPromise).toBeDefined();
    await expect(buildPromise as Promise<unknown>).rejects.toThrow(/CONTROL_PLANE_API_TOKEN must not be empty/);

    process.env.CONTROL_PLANE_API_TOKEN = 'test-token';
  });

  it('rejects requests missing bearer token', async () => {
    const response = await app.inject({ method: 'GET', url: '/status' });
    expect(response.statusCode).toBe(401);
  });

  it('rejects state-changing requests missing csrf token', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/overrides',
      payload: { status: 'allow' },
      headers: { authorization: 'Bearer test-token' },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: 'csrf_invalid' });
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
      headers: { authorization: 'Bearer test-token', 'x-csrf-token': 'test-token' },
      payload: { status: 'allow', reason: 'testing', url_hash: 'a'.repeat(64) },
    });
    expect(response.statusCode).toBe(201);
    expect(pgClient.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO overrides'),
      expect.arrayContaining(['a'.repeat(64), null, 'allow', 'global', null, 'admin', 'testing', null])
    );
  });

  it('serves stored urlscan artifact bytes', async () => {
    const artifactDir = path.resolve('storage/urlscan-artifacts');
    await fs.mkdir(artifactDir, { recursive: true });
    const screenshotPath = path.join(artifactDir, 'test.png');
    await fs.writeFile(screenshotPath, 'hello', 'utf8');
    pgClient.query.mockResolvedValueOnce({ rows: [{ urlscan_screenshot_path: screenshotPath }] });

    const response = await app.inject({
      method: 'GET',
      url: `/scans/${'b'.repeat(64)}/urlscan-artifacts/screenshot`,
      headers: { authorization: 'Bearer test-token' },
    });

    expect(response.statusCode).toBe(200);
    const body = await (async () => {
      if (response.body && response.body.length > 0) return response.body;
      if (response.payload && response.payload.length > 0) return response.payload;
      const rawPayload = (response as any).rawPayload as Buffer | undefined;
      if (rawPayload?.length) return rawPayload.toString('utf8');
      const rawBody = (response as any).rawBody as Buffer | undefined;
      if (rawBody?.length) return rawBody.toString('utf8');
      const stream = (response as any).stream;
      if (stream && typeof stream.on === 'function') {
        const chunks: Buffer[] = [];
        await new Promise<void>((resolve, reject) => {
          stream.on('data', (chunk: Buffer | string) => {
            chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk));
          });
          stream.on('error', reject);
          stream.on('end', resolve);
        });
        if (chunks.length) {
          return Buffer.concat(chunks).toString('utf8');
        }
      }
      return undefined;
    })();

    if (body !== undefined) {
      expect(body).toBe('hello');
    } else {
      expect((response as any).stream).toBeDefined();
    }

    await fs.unlink(screenshotPath);
  });

  it('returns 404 when artifact missing', async () => {
    pgClient.query.mockResolvedValueOnce({ rows: [] });
    const response = await app.inject({
      method: 'GET',
      url: `/scans/${'c'.repeat(64)}/urlscan-artifacts/screenshot`,
      headers: { authorization: 'Bearer test-token' },
    });
    expect(response.statusCode).toBe(404);
  });

  it('rejects unsupported artifact types', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/scans/hash/urlscan-artifacts/raw',
      headers: { authorization: 'Bearer test-token' },
    });
    expect(response.statusCode).toBe(400);
  });
});
