// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handleDelete, handleKeyDown } from './key-events.util';

vi.mock('fabric', () => {
  class MockActiveSelection {
    constructor(
      public objects: unknown[],
      public options: unknown,
    ) {}
  }

  return {
    Canvas: vi.fn(),
    ActiveSelection: MockActiveSelection,
    util: { enlivenObjects: vi.fn() },
  };
});

describe('key-events.util', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockCanvas: any;
  let undo: ReturnType<typeof vi.fn>;
  let redo: ReturnType<typeof vi.fn>;
  let syncShapeInStorage: ReturnType<typeof vi.fn>;
  let deleteShapeFromStorage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCanvas = {
      getActiveObject: vi.fn(),
      getActiveObjects: vi.fn().mockReturnValue([]),
      getObjects: vi.fn().mockReturnValue([]),
      setActiveObject: vi.fn(),
      discardActiveObject: vi.fn(),
      requestRenderAll: vi.fn(),
      renderAll: vi.fn(),
      remove: vi.fn(),
      add: vi.fn(),
    };
    undo = vi.fn();
    redo = vi.fn();
    syncShapeInStorage = vi.fn();
    deleteShapeFromStorage = vi.fn();
  });

  describe('handleDelete', () => {
    it('removes objects with objectId and discards active object', () => {
      const obj1 = { objectId: 'id-1' };
      const obj2 = { objectId: undefined };
      const obj3 = { objectId: 'id-3' };
      mockCanvas.getActiveObjects.mockReturnValue([obj1, obj2, obj3]);

      handleDelete(mockCanvas, deleteShapeFromStorage);

      expect(mockCanvas.remove).toHaveBeenCalledWith(obj1);
      expect(mockCanvas.remove).not.toHaveBeenCalledWith(obj2);
      expect(mockCanvas.remove).toHaveBeenCalledWith(obj3);
      expect(deleteShapeFromStorage).toHaveBeenCalledWith('id-1');
      expect(deleteShapeFromStorage).toHaveBeenCalledWith('id-3');
      expect(mockCanvas.discardActiveObject).toHaveBeenCalled();
      expect(mockCanvas.requestRenderAll).toHaveBeenCalled();
    });

    it('does nothing when no objects are active', () => {
      mockCanvas.getActiveObjects.mockReturnValue([]);

      handleDelete(mockCanvas, deleteShapeFromStorage);

      expect(mockCanvas.remove).not.toHaveBeenCalled();
      expect(deleteShapeFromStorage).not.toHaveBeenCalled();
    });
  });

  describe('handleKeyDown', () => {
    it('ignores shortcuts when typing in an input element', () => {
      const input = document.createElement('input');
      const event = new KeyboardEvent('keydown', { key: 'Delete' });
      Object.defineProperty(event, 'target', { value: input });
      const preventDefault = vi.spyOn(event, 'preventDefault');

      handleKeyDown({
        e: event,
        canvas: mockCanvas,
        undo,
        redo,
        syncShapeInStorage,
        deleteShapeFromStorage,
      });

      expect(preventDefault).not.toHaveBeenCalled();
      expect(deleteShapeFromStorage).not.toHaveBeenCalled();
    });

    it('selects all selectable objects on mod+A', () => {
      const obj1 = { selectable: true };
      const obj2 = { selectable: false };
      const obj3 = { selectable: true };
      mockCanvas.getObjects.mockReturnValue([obj1, obj2, obj3]);

      const event = new KeyboardEvent('keydown', { code: 'KeyA', metaKey: true });
      const preventDefault = vi.spyOn(event, 'preventDefault');

      handleKeyDown({
        e: event,
        canvas: mockCanvas,
        undo,
        redo,
        syncShapeInStorage,
        deleteShapeFromStorage,
      });

      expect(preventDefault).toHaveBeenCalled();
      expect(mockCanvas.discardActiveObject).toHaveBeenCalled();
      expect(mockCanvas.setActiveObject).toHaveBeenCalled();
      expect(mockCanvas.requestRenderAll).toHaveBeenCalled();
    });

    it('sets single active object directly on mod+A when only one selectable object exists', () => {
      const obj1 = { selectable: true };
      mockCanvas.getObjects.mockReturnValue([obj1]);

      const event = new KeyboardEvent('keydown', { code: 'KeyA', ctrlKey: true });
      handleKeyDown({
        e: event,
        canvas: mockCanvas,
        undo,
        redo,
        syncShapeInStorage,
        deleteShapeFromStorage,
      });

      expect(mockCanvas.setActiveObject).toHaveBeenCalledWith(obj1);
      expect(mockCanvas.requestRenderAll).toHaveBeenCalled();
    });

    it('deselects active objects on Escape', () => {
      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      const preventDefault = vi.spyOn(event, 'preventDefault');

      handleKeyDown({
        e: event,
        canvas: mockCanvas,
        undo,
        redo,
        syncShapeInStorage,
        deleteShapeFromStorage,
      });

      expect(preventDefault).toHaveBeenCalled();
      expect(mockCanvas.discardActiveObject).toHaveBeenCalled();
      expect(mockCanvas.requestRenderAll).toHaveBeenCalled();
    });

    it('nudges active object with Arrow keys by 1px (or 10px with Shift)', () => {
      const activeObj = {
        left: 50,
        top: 100,
        set: vi.fn(),
        setCoords: vi.fn(),
      };
      mockCanvas.getActiveObject.mockReturnValue(activeObj);

      const eventUp = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      handleKeyDown({
        e: eventUp,
        canvas: mockCanvas,
        undo,
        redo,
        syncShapeInStorage,
        deleteShapeFromStorage,
      });

      expect(activeObj.set).toHaveBeenCalledWith({ left: 50, top: 99 });
      expect(activeObj.setCoords).toHaveBeenCalled();
      expect(syncShapeInStorage).toHaveBeenCalledWith(activeObj);

      const eventRightShift = new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true });
      handleKeyDown({
        e: eventRightShift,
        canvas: mockCanvas,
        undo,
        redo,
        syncShapeInStorage,
        deleteShapeFromStorage,
      });

      expect(activeObj.set).toHaveBeenCalledWith({ left: 60, top: 100 });
      expect(syncShapeInStorage).toHaveBeenCalledWith(activeObj);
    });

    it('calls undo on mod+Z and redo on mod+Shift+Z or mod+Y', () => {
      const eventUndo = new KeyboardEvent('keydown', { code: 'KeyZ', metaKey: true });
      handleKeyDown({
        e: eventUndo,
        canvas: mockCanvas,
        undo,
        redo,
        syncShapeInStorage,
        deleteShapeFromStorage,
      });
      expect(undo).toHaveBeenCalledOnce();

      const eventRedoShift = new KeyboardEvent('keydown', { code: 'KeyZ', metaKey: true, shiftKey: true });
      handleKeyDown({
        e: eventRedoShift,
        canvas: mockCanvas,
        undo,
        redo,
        syncShapeInStorage,
        deleteShapeFromStorage,
      });
      expect(redo).toHaveBeenCalledOnce();

      const eventRedoY = new KeyboardEvent('keydown', { code: 'KeyY', ctrlKey: true });
      handleKeyDown({
        e: eventRedoY,
        canvas: mockCanvas,
        undo,
        redo,
        syncShapeInStorage,
        deleteShapeFromStorage,
      });
      expect(redo).toHaveBeenCalledTimes(2);
    });
  });
});
