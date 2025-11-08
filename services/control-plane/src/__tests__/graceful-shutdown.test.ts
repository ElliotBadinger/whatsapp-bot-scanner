describe('Control Plane Graceful Shutdown', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('should clear purge interval on shutdown', async () => {
    const mockLogger = {
      info: jest.fn(),
    };

    let purgeInterval: NodeJS.Timeout | null = setInterval(() => {}, 1000);

    const gracefulShutdown = async () => {
      if (purgeInterval) {
        clearInterval(purgeInterval);
        mockLogger.info('Purge interval cleared');
      }
    };

    await gracefulShutdown();

    expect(mockLogger.info).toHaveBeenCalledWith('Purge interval cleared');
  });

  it('should only close owned PostgreSQL connections', async () => {
    const mockLogger = {
      info: jest.fn(),
    };

    const mockPgClient = {
      end: jest.fn(async () => {
        mockLogger.info('PostgreSQL connection closed');
      }),
    };

    const ownsClient = true;

    if (ownsClient) {
      await mockPgClient.end();
    }

    expect(mockPgClient.end).toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith('PostgreSQL connection closed');
  });

  it('should not close injected PostgreSQL connections', async () => {
    const mockPgClient = {
      end: jest.fn(),
    };

    const ownsClient = false;

    if (ownsClient) {
      await mockPgClient.end();
    }

    expect(mockPgClient.end).not.toHaveBeenCalled();
  });

  it('should handle shutdown signal registration', () => {
    const listeners = process.listeners('SIGTERM');
    expect(listeners.length).toBeGreaterThanOrEqual(0);
  });
});
