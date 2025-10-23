export function createAsyncDebouncer(intervalMs: number) {
  let lastRun = 0;
  let running = false;

  return async (fn: () => Promise<void>) => {
    const now = Date.now();
    if (running) return;
    if (now - lastRun < intervalMs) return;
    running = true;
    try {
      await fn();
      lastRun = Date.now();
    } finally {
      running = false;
    }
  };
}
