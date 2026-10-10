import { describe, expect, it } from 'vitest';

import { formatDurationMs } from './format-duration.util.js';

describe('formatDurationMs', () => {
  it('formats 0 and negative values as 0:00', () => {
    expect(formatDurationMs(0)).toBe('0:00');
    expect(formatDurationMs(-500)).toBe('0:00');
    expect(formatDurationMs(-10000)).toBe('0:00');
  });

  it('handles non-finite values safely', () => {
    expect(formatDurationMs(NaN)).toBe('0:00');
    expect(formatDurationMs(Infinity)).toBe('0:00');
    expect(formatDurationMs(-Infinity)).toBe('0:00');
  });

  it('formats seconds and sub-minute durations with leading zero for seconds', () => {
    expect(formatDurationMs(500)).toBe('0:00');
    expect(formatDurationMs(1000)).toBe('0:01');
    expect(formatDurationMs(9000)).toBe('0:09');
    expect(formatDurationMs(10000)).toBe('0:10');
    expect(formatDurationMs(59000)).toBe('0:59');
  });

  it('formats minute durations as M:SS', () => {
    expect(formatDurationMs(60000)).toBe('1:00');
    expect(formatDurationMs(65000)).toBe('1:05');
    expect(formatDurationMs(125000)).toBe('2:05');
    expect(formatDurationMs(599000)).toBe('9:59');
    expect(formatDurationMs(3599000)).toBe('59:59');
  });

  it('formats hour-long durations as H:MM:SS with zero-padded minutes and seconds', () => {
    expect(formatDurationMs(3600000)).toBe('1:00:00');
    expect(formatDurationMs(3601000)).toBe('1:00:01');
    expect(formatDurationMs(3665000)).toBe('1:01:05');
    expect(formatDurationMs(7325000)).toBe('2:02:05');
    expect(formatDurationMs(36000000)).toBe('10:00:00');
  });
});
