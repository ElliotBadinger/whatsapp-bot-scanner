import pino from 'pino';

const isHobbyMode = process.env.NODE_ENV !== 'production';
const isTestEnv = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;

// In test environment, use simple pino without transport to avoid worker thread issues
// In hobby/dev mode, use pino-pretty transport for readable logs
// In production, use structured JSON logging with redaction
export const logger = pino(
  isTestEnv
    ? { level: 'silent' }
    : isHobbyMode
      ? {
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss',
              ignore: 'pid,hostname',
              messageFormat: '{msg}',
            },
          },
        }
      : {
          level: process.env.LOG_LEVEL || 'info',
          redact: {
            paths: ['req.headers.authorization', 'authorization', 'vt.apiKey', 'gsb.apiKey'],
            remove: true,
          },
        }
);
