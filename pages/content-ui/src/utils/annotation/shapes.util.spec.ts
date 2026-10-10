// @vitest-environment jsdom
import type { Canvas } from 'fabric';
import { describe, expect, it, vi } from 'vitest';

import { handleDelete } from './key-events.util';
import { bringElement, createBlur, DEFAULT_BLUR_RADIUS } from './shapes.util';

vi.mock('fabric', () => {
  class MockRect {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(public options: any) {
      Object.assign(this, options);
    }
  }

  class MockFiltersBlur {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(public options: any) {}
  }

  return {
    Canvas: vi.fn(),
    Rect: MockRect,
    Line: vi.fn(),
    Triangle: vi.fn(),
    Circle: vi.fn(),
    Group: vi.fn(),
    IText: vi.fn(),
    FabricImage: vi.fn(),
    FabricText: vi.fn(),
    filters: {
      Blur: MockFiltersBlur,
    },
  };
});

describe('shapes.util and blur layer cleanup', () => {
  it('exports DEFAULT_BLUR_RADIUS as 0.5', () => {
    expect(DEFAULT_BLUR_RADIUS).toBe(0.5);
  });

  describe('createBlur', () => {
    it('throws if background image is not set on canvas', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockCanvas: any = {
        backgroundImage: null,
      };

      expect(() => createBlur(mockCanvas, { x: 10, y: 20 } as unknown as PointerEvent)).toThrow(
        '[Brie] Background image must be set before blur tool',
      );
    });

    it('creates blurred clone linked to blur-window rect', () => {
      const mockBlurredClone = {
        filters: [],
        applyFilters: vi.fn(),
        set: vi.fn(),
        clipPath: null,
      };

      const mockBg = {
        cloneAsImage: vi.fn().mockReturnValue(mockBlurredClone),
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockCanvas: any = {
        backgroundImage: mockBg,
        add: vi.fn(),
        sendObjectToBack: vi.fn(),
      };

      const rect = createBlur(mockCanvas, { x: 50, y: 75 } as unknown as PointerEvent);

      expect((rect as { data?: unknown }).data).toBe('blur-window');
      expect((rect as { blurRadius?: unknown }).blurRadius).toBe(DEFAULT_BLUR_RADIUS);
      expect(rect.left).toBe(50);
      expect(rect.top).toBe(75);

      expect(mockBlurredClone.applyFilters).toHaveBeenCalled();
      expect(mockBlurredClone.set).toHaveBeenCalledWith(
        expect.objectContaining({
          data: 'blur-layer',
          selectable: false,
          evented: false,
          blurWindowId: (rect as unknown as { objectId: string }).objectId,
        }),
      );
      expect(mockCanvas.add).toHaveBeenCalledWith(mockBlurredClone);
      expect(mockCanvas.sendObjectToBack).toHaveBeenCalledWith(mockBlurredClone);
      expect(mockBlurredClone.clipPath).toBe(rect);
    });
  });

  describe('handleDelete blur layer cleanup', () => {
    it('removes orphaned blur layers when a blur-window is deleted', () => {
      const deleteShapeFromStorage = vi.fn();

      const blurWindow = {
        objectId: 'win-123',
        data: 'blur-window',
        shapeType: 'blur',
      };

      const blurLayer1 = {
        data: 'blur-layer',
        blurWindowId: 'win-123',
      };

      const blurLayer2 = {
        data: 'blur-layer',
        blurWindowId: 'other-win',
      };

      const normalObject = {
        objectId: 'normal-1',
        data: 'rect',
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockCanvas: any = {
        getActiveObjects: vi.fn().mockReturnValue([blurWindow]),
        getObjects: vi.fn().mockReturnValue([blurWindow, blurLayer1, blurLayer2, normalObject]),
        remove: vi.fn(),
        discardActiveObject: vi.fn(),
        requestRenderAll: vi.fn(),
      };

      handleDelete(mockCanvas, deleteShapeFromStorage);

      expect(mockCanvas.remove).toHaveBeenCalledWith(blurWindow);
      expect(mockCanvas.remove).toHaveBeenCalledWith(blurLayer1);
      expect(mockCanvas.remove).not.toHaveBeenCalledWith(blurLayer2);
      expect(deleteShapeFromStorage).toHaveBeenCalledWith('win-123');
      expect(mockCanvas.discardActiveObject).toHaveBeenCalled();
      expect(mockCanvas.requestRenderAll).toHaveBeenCalled();
    });
  });

  describe('bringElement', () => {
    it('returns early when canvas is null or no active object exists', () => {
      const syncShape = vi.fn();
      expect(() =>
        bringElement({
          canvas: null as unknown as Canvas,
          direction: 'front',
          syncShapeInStorage: syncShape,
        }),
      ).not.toThrow();

      const mockCanvas = {
        getActiveObject: vi.fn().mockReturnValue(null),
        bringObjectToFront: vi.fn(),
        requestRenderAll: vi.fn(),
      } as unknown as Canvas;
      bringElement({ canvas: mockCanvas, direction: 'front', syncShapeInStorage: syncShape });
      expect(mockCanvas.bringObjectToFront).not.toHaveBeenCalled();
      expect(mockCanvas.requestRenderAll).not.toHaveBeenCalled();
      expect(syncShape).not.toHaveBeenCalled();
    });

    it('returns early when active object is activeSelection', () => {
      const syncShape = vi.fn();
      const mockCanvas = {
        getActiveObject: vi.fn().mockReturnValue({ type: 'activeSelection' }),
        bringObjectToFront: vi.fn(),
        requestRenderAll: vi.fn(),
      } as unknown as Canvas;
      bringElement({ canvas: mockCanvas, direction: 'front', syncShapeInStorage: syncShape });
      expect(mockCanvas.bringObjectToFront).not.toHaveBeenCalled();
      expect(mockCanvas.requestRenderAll).not.toHaveBeenCalled();
      expect(syncShape).not.toHaveBeenCalled();
    });

    it('brings element to front, renders canvas, and syncs shape', () => {
      const syncShape = vi.fn();
      const mockObj = { type: 'rect', objectId: 'rect-1' };
      const mockCanvas = {
        getActiveObject: vi.fn().mockReturnValue(mockObj),
        bringObjectToFront: vi.fn(),
        requestRenderAll: vi.fn(),
      } as unknown as Canvas;
      bringElement({ canvas: mockCanvas, direction: 'front', syncShapeInStorage: syncShape });
      expect(mockCanvas.bringObjectToFront).toHaveBeenCalledWith(mockObj as never);
      expect(mockCanvas.requestRenderAll).toHaveBeenCalled();
      expect(syncShape).toHaveBeenCalledWith(mockObj as never);
    });

    it('sends element to back, renders canvas, and syncs shape', () => {
      const syncShape = vi.fn();
      const mockObj = { type: 'rect', objectId: 'rect-2' };
      const mockCanvas = {
        getActiveObject: vi.fn().mockReturnValue(mockObj),
        sendObjectToBack: vi.fn(),
        requestRenderAll: vi.fn(),
      } as unknown as Canvas;
      bringElement({ canvas: mockCanvas, direction: 'back', syncShapeInStorage: syncShape });
      expect(mockCanvas.sendObjectToBack).toHaveBeenCalledWith(mockObj as never);
      expect(mockCanvas.requestRenderAll).toHaveBeenCalled();
      expect(syncShape).toHaveBeenCalledWith(mockObj as never);
    });
  });
});
