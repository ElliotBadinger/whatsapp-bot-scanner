import { jest } from '@jest/globals';
import { createAsyncDebouncer } from '../utils/debounce';

describe('createAsyncDebouncer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('executes immediately and blocks calls within the interval', async () => {
    const debouncer = createAsyncDebouncer(1000);
    const fn = jest.fn(async () => undefined);

    await debouncer(fn);
    await debouncer(fn);
    expect(fn).toHaveBeenCalledTimes(1);

    jest.setSystemTime(Date.now() + 1000);
    await debouncer(fn);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test('prevents concurrent executions while a call is running', async () => {
    const debouncer = createAsyncDebouncer(1000);
    let resolve!: () => void;
    const pending = new Promise<void>((res) => {
      resolve = res;
    });
    const fn = jest.fn(() => pending);

    const firstCall = debouncer(fn);
    await debouncer(fn);
    expect(fn).toHaveBeenCalledTimes(1);

    resolve();
    await firstCall;
  });
});
