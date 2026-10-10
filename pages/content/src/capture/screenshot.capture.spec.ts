// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { addBoundaryBox, cleanup, cropSelectedArea } from './screenshot.capture';

describe('screenshot.capture utilities', () => {
  let mockCanvas: HTMLCanvasElement;
  let mockCtx: CanvasRenderingContext2D;
  const originalGetContext = HTMLCanvasElement.prototype.getContext;

  beforeEach(() => {
    mockCtx = {
      drawImage: vi.fn(),
      strokeRect: vi.fn(),
      strokeStyle: '',
      lineWidth: 0,
    } as unknown as CanvasRenderingContext2D;

    mockCanvas = {
      width: 1000,
      height: 800,
      getContext: vi.fn().mockReturnValue(mockCtx),
    } as unknown as HTMLCanvasElement;

    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(mockCtx);
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  describe('cropSelectedArea', () => {
    it('crops within canvas bounds and scales dimensions', () => {
      const cropped = cropSelectedArea(mockCanvas, 10, 20, 100, 50, 2);
      expect(cropped.width).toBe(200);
      expect(cropped.height).toBe(100);
    });

    it('clamps negative x and y to 0', () => {
      const cropped = cropSelectedArea(mockCanvas, -50, -30, 200, 150, 1);
      expect(cropped.width).toBe(200);
      expect(cropped.height).toBe(150);
      expect(mockCtx.drawImage).toHaveBeenCalledWith(mockCanvas, 0, 0, 200, 150, 0, 0, 200, 150);
    });

    it('clamps dimensions exceeding canvas boundaries', () => {
      const cropped = cropSelectedArea(mockCanvas, 900, 700, 300, 300, 1);
      expect(cropped.width).toBe(100);
      expect(cropped.height).toBe(100);
    });
  });

  describe('addBoundaryBox', () => {
    it('draws a scaled boundary box with scaled stroke width', () => {
      addBoundaryBox(mockCanvas, 50, 60, 200, 100, 2);
      expect(mockCtx.strokeStyle).toBe('red');
      expect(mockCtx.lineWidth).toBe(8); // 4 * 2
      expect(mockCtx.strokeRect).toHaveBeenCalledWith(100, 120, 400, 200);
    });

    it('clamps boundary coordinates and dimensions', () => {
      addBoundaryBox(mockCanvas, -10, -20, 1200, 900, 1);
      expect(mockCtx.strokeRect).toHaveBeenCalledWith(0, 0, 1000, 800);
    });
  });

  describe('cleanup', () => {
    it('runs cleanup without errors', () => {
      expect(() => cleanup()).not.toThrow();
    });
  });
});
