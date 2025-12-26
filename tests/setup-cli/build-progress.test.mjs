import { describe, it, expect } from 'vitest';
import {
  BuildByteTracker,
  parseBuildkitProgress,
  formatBytes,
} from '../../scripts/cli/core/build-progress.mjs';

describe('build progress parsing', () => {
  it('parses buildkit raw json with byte progress', () => {
    const line = JSON.stringify({
      id: 'layer-1',
      status: 'Downloading',
      progressDetail: { current: 512, total: 1024 },
    });
    const parsed = parseBuildkitProgress(line);
    expect(parsed).toEqual({
      id: 'layer-1',
      current: 512,
      total: 1024,
    });
  });

  it('ignores non-json or missing totals', () => {
    expect(parseBuildkitProgress('not-json')).toBeNull();
    expect(parseBuildkitProgress(JSON.stringify({ status: 'Starting' }))).toBeNull();
    expect(
      parseBuildkitProgress(
        JSON.stringify({ progressDetail: { current: 1 } })
      )
    ).toBeNull();
  });
});

describe('build progress aggregation', () => {
  it('aggregates bytes across multiple layers', () => {
    const tracker = new BuildByteTracker();
    tracker.updateFromLine(
      JSON.stringify({
        id: 'layer-a',
        progressDetail: { current: 128, total: 256 },
      })
    );
    tracker.updateFromLine(
      JSON.stringify({
        id: 'layer-b',
        progressDetail: { current: 512, total: 1024 },
      })
    );

    const totals = tracker.getTotals();
    expect(totals).toEqual({ currentBytes: 640, totalBytes: 1280 });
  });

  it('formats bytes for display', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1024)).toBe('1.00 KB');
    expect(formatBytes(1024 * 1024)).toBe('1.00 MB');
  });
});
