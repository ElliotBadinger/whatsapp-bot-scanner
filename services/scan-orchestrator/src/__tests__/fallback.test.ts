process.env.NODE_ENV = 'test';

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
  }));
});

jest.mock('bullmq', () => {
  return {
    Queue: jest.fn().mockImplementation(() => ({
      add: jest.fn().mockResolvedValue(null),
    })),
    Worker: jest.fn().mockImplementation(() => ({})),
  };
});

jest.mock('pg', () => {
  return {
    Client: jest.fn().mockImplementation(() => ({
      connect: jest.fn().mockResolvedValue(null),
      query: jest.fn().mockResolvedValue({ rows: [] }),
      end: jest.fn().mockResolvedValue(null),
    })),
  };
});

import { __testables } from '../index';

describe('error classification helpers', () => {
  it('classifies rate limit errors', () => {
    const reason = __testables.classifyError({ code: 429 });
    expect(reason).toBe('rate_limited');
  });

  it('classifies undici timeout errors', () => {
    const reason = __testables.classifyError({ code: 'UND_ERR_HEADERS_TIMEOUT' });
    expect(reason).toBe('timeout');
  });
});

describe('retry policy', () => {
  it('retries on 5xx errors', () => {
    expect(__testables.shouldRetry({ statusCode: 502 })).toBe(true);
  });

  it('does not retry on rate-limit errors', () => {
    expect(__testables.shouldRetry({ code: 429 })).toBe(false);
  });
});
