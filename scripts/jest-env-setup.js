process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.URLSCAN_CALLBACK_SECRET = process.env.URLSCAN_CALLBACK_SECRET || 'test-secret';
process.env.CONTROL_PLANE_API_TOKEN = process.env.CONTROL_PLANE_API_TOKEN || 'test-token';
process.env.VT_API_KEY = process.env.VT_API_KEY || 'test-vt-key';
process.env.WHOISXML_API_KEY = process.env.WHOISXML_API_KEY || 'test-whois-key';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379/0';
process.env.POSTGRES_HOST = process.env.POSTGRES_HOST || 'localhost';
process.env.POSTGRES_PORT = process.env.POSTGRES_PORT || '5432';
process.env.POSTGRES_DB = process.env.POSTGRES_DB || 'wbscanner';
process.env.POSTGRES_USER = process.env.POSTGRES_USER || 'wbscanner';
process.env.POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || 'wbscanner';

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    quit: jest.fn(),
    duplicate: jest.fn().mockReturnThis(),
    del: jest.fn().mockResolvedValue(1),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
  }));
});

jest.mock('bullmq', () => {
  const queueAdd = jest.fn().mockResolvedValue(undefined);
  const Queue = jest.fn().mockImplementation(() => ({
    add: queueAdd,
    on: jest.fn(),
  }));
  const Worker = jest.fn();
  return { Queue, Worker };
});
