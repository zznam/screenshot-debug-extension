import { describe, expect, it } from 'vitest';

import { hexToRgba } from './hex-to-rgba.util';

describe('hexToRgba', () => {
  it('converts standard 6-digit hex color with alpha', () => {
    expect(hexToRgba('#ff0000', 1)).toBe('rgba(255,0,0,1)');
    expect(hexToRgba('#00ff00', 0.5)).toBe('rgba(0,255,0,0.5)');
    expect(hexToRgba('#0000ff', 0)).toBe('rgba(0,0,255,0)');
  });

  it('correctly expands 3-digit hex shorthand (#rgb)', () => {
    expect(hexToRgba('#fff', 1)).toBe('rgba(255,255,255,1)');
    expect(hexToRgba('#000', 1)).toBe('rgba(0,0,0,1)');
    expect(hexToRgba('#f00', 1)).toBe('rgba(255,0,0,1)');
    expect(hexToRgba('#0f0', 0.8)).toBe('rgba(0,255,0,0.8)');
    expect(hexToRgba('#00f', 1)).toBe('rgba(0,0,255,1)');
  });

  it('handles hex strings without leading #', () => {
    expect(hexToRgba('ffffff', 1)).toBe('rgba(255,255,255,1)');
    expect(hexToRgba('fff', 1)).toBe('rgba(255,255,255,1)');
  });

  it('clamps alpha to [0, 1]', () => {
    expect(hexToRgba('#ffffff', 1.5)).toBe('rgba(255,255,255,1)');
    expect(hexToRgba('#ffffff', -0.5)).toBe('rgba(255,255,255,0)');
  });

  it('handles invalid hex strings gracefully with fallback', () => {
    expect(hexToRgba('invalid', 1)).toBe('rgba(0,0,0,1)');
    expect(hexToRgba('', 0.5)).toBe('rgba(0,0,0,0.5)');
    expect(hexToRgba('#12', 1)).toBe('rgba(0,0,0,1)');
  });
});
