import pino from 'pino';

const isHobbyMode = process.env.NODE_ENV !== 'production';
const isTestEnv = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;
const isPrettyRequested =
  process.env.LOG_PRETTY === '1' || process.env.LOG_PRETTY === 'true';

// Check if pino-pretty is available (it's a dev dependency)
function isPinoPrettyAvailable(): boolean {
  try {
    require.resolve('pino-pretty');
    return true;
  } catch {
    return false;
  }
}

// In test environment, use simple pino without transport to avoid worker thread issues
// In hobby/dev mode, use pino-pretty transport for readable logs (if available)
// In production, use structured JSON logging with redaction
function createLogger() {
  if (isTestEnv) {
    return pino({ level: 'silent' });
  }

  if ((isHobbyMode || isPrettyRequested) && isPinoPrettyAvailable()) {
    return pino({
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
          messageFormat: '{msg}',
        },
      },
    });
  }

  // Production or hobby mode without pino-pretty
  return pino({
    level: process.env.LOG_LEVEL || 'info',
    redact: {
      paths: ['req.headers.authorization', 'authorization', 'vt.apiKey', 'gsb.apiKey'],
      remove: true,
    },
  });
}

export const logger = createLogger();
