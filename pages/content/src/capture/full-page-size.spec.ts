import { describe, expect, it } from 'vitest';

import { fullPageSize } from './full-page-size';

describe('full-page bitmap budget', () => {
  it('preserves normal viewport resolution and limits high-density output', () => {
    expect(fullPageSize(1200, 900, 1)).toEqual({ width: 1200, height: 900, scale: 1 });
    expect(fullPageSize(1200, 900, 4).scale).toBe(2);
    expect(fullPageSize(1200, 900, 0.25).scale).toBe(1);
  });
  it('scales tall pages within both the pixel and side budgets', () => {
    const { width, height, scale } = fullPageSize(1200, 18000, 2);
    expect(width * height * scale ** 2).toBeLessThanOrEqual(16_000_001);
    expect(Math.max(width, height) * scale).toBeLessThanOrEqual(16_384);
    expect(scale).toBeGreaterThanOrEqual(0.5);
  });
  it.each([
    [0, 100],
    [100, -1],
    [Infinity, 100],
    [100, NaN],
    [1000, 100000],
  ])('rejects unusable dimensions %s x %s with an alternative capture mode', (width, height) => {
    expect(() => fullPageSize(width, height, 2)).toThrow(/viewport/);
  });
  it.each([0, NaN, Infinity, -1])('normalizes an invalid device scale %s', ratio => {
    expect(fullPageSize(100, 100, ratio).scale).toBe(1);
  });
});
