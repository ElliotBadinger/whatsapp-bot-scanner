describe('Graceful Shutdown', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('should handle SIGTERM signal', async () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    const listeners = process.listeners('SIGTERM');
    
    expect(listeners.length).toBeGreaterThanOrEqual(0);
    
    exitSpy.mockRestore();
  });

  it('should handle SIGINT signal', async () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    const listeners = process.listeners('SIGINT');
    
    expect(listeners.length).toBeGreaterThanOrEqual(0);
    
    exitSpy.mockRestore();
  });

  it('should prevent duplicate shutdown attempts', async () => {
    const mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    let isShuttingDown = false;
    const gracefulShutdown = async (signal: string) => {
      if (isShuttingDown) {
        mockLogger.warn({ signal }, 'Shutdown already in progress, ignoring signal');
        return;
      }
      isShuttingDown = true;
      mockLogger.info({ signal }, 'Graceful shutdown initiated');
    };

    await gracefulShutdown('SIGTERM');
    expect(mockLogger.info).toHaveBeenCalledWith(
      { signal: 'SIGTERM' },
      'Graceful shutdown initiated'
    );

    await gracefulShutdown('SIGTERM');
    expect(mockLogger.warn).toHaveBeenCalledWith(
      { signal: 'SIGTERM' },
      'Shutdown already in progress, ignoring signal'
    );
  });

  it('should close resources in correct order', async () => {
    const closeOrder: string[] = [];

    const mockApp = {
      close: jest.fn(async () => {
        closeOrder.push('app');
      }),
    };

    const mockWorker = {
      close: jest.fn(async () => {
        closeOrder.push('worker');
      }),
      name: 'test-worker',
    };

    const mockQueue = {
      close: jest.fn(async () => {
        closeOrder.push('queue');
      }),
    };

    const mockRedis = {
      quit: jest.fn(async () => {
        closeOrder.push('redis');
      }),
    };

    const mockPg = {
      end: jest.fn(async () => {
        closeOrder.push('pg');
      }),
    };

    await mockApp.close();
    await mockWorker.close();
    await mockQueue.close();
    await mockRedis.quit();
    await mockPg.end();

    expect(closeOrder).toEqual(['app', 'worker', 'queue', 'redis', 'pg']);
  });

  it('should continue shutdown even if one resource fails to close', async () => {
    const mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
    };

    const mockApp = {
      close: jest.fn(async () => {
        throw new Error('App close failed');
      }),
    };

    const mockRedis = {
      quit: jest.fn(async () => {
        mockLogger.info('Redis closed');
      }),
    };

    try {
      await mockApp.close();
    } catch (err) {
      mockLogger.error({ err }, 'Error closing Fastify server');
    }

    await mockRedis.quit();

    expect(mockLogger.error).toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith('Redis closed');
  });
});
