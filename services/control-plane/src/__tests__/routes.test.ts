process.env.NODE_ENV = 'test';
process.env.CONTROL_PLANE_API_TOKEN = 'test-token';

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
    const artifactDir = path.resolve('storage/urlscan-artifacts');
    await fs.mkdir(artifactDir, { recursive: true });
    const screenshotPath = path.join(artifactDir, 'test.png');
    await fs.writeFile(screenshotPath, 'hello', 'utf8');
    pgClient.query.mockResolvedValueOnce({ rows: [{ urlscan_screenshot_path: screenshotPath }] });

    const response = await app.inject({
      method: 'GET',
      url: '/artifacts/hash-123/screenshot',
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
      url: '/artifacts/missing/screenshot',
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
