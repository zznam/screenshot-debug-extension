import type { FabricObject } from 'fabric';
import { ActiveSelection, Canvas, util } from 'fabric';
import { v4 as uuidv4 } from 'uuid';

import type { CustomFabricObject, HandleKeyDownDeps } from '@src/models';

/**
 * Is the event target a native form field or contentEditable node?
 */
const isDomEditor = (el: EventTarget | null): el is HTMLElement =>
  !!el && (/^(INPUT|TEXTAREA|SELECT)$/i.test((el as HTMLElement).tagName) || (el as HTMLElement).isContentEditable);

/**
 * Returns `true` when a Fabric text object is currently being edited.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isFabricEditing = (canvas: Canvas): boolean => !!(canvas.getActiveObject() as any)?.isEditing;

export const handleCopy = (canvas: Canvas) => {
  const activeObjects = canvas.getActiveObjects();
  if (activeObjects.length > 0) {
    // Serialize the selected objects
    const serializedObjects = activeObjects.map(obj => obj.toObject());
    // Store the serialized objects in the clipboard
    localStorage.setItem('clipboard', JSON.stringify(serializedObjects));
  }

  return activeObjects;
};

export const handlePaste = (canvas: Canvas, syncShapeInStorage: (shape: FabricObject) => void) => {
  if (!canvas || !(canvas instanceof Canvas)) {
    console.error('Invalid canvas object. Aborting paste operation.');
    return;
  }

  // Retrieve serialized objects from the clipboard
  const clipboardData = localStorage.getItem('clipboard');

  if (clipboardData) {
    try {
      const parsedObjects = JSON.parse(clipboardData);
      parsedObjects.forEach((objData: FabricObject) => {
        // convert the plain javascript objects retrieved from localStorage into fabricjs objects (deserialization)
        util.enlivenObjects<FabricObject>([objData]).then((enlivenedObjects: FabricObject[]) => {
          enlivenedObjects.forEach(enlivenedObj => {
            // Offset the pasted objects to avoid overlap with existing objects
            enlivenedObj.set({
              left: enlivenedObj.left || 0 + 20,
              top: enlivenedObj.top || 0 + 20,

              objectId: uuidv4(),
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as CustomFabricObject<any>);

            canvas.add(enlivenedObj);
            syncShapeInStorage(enlivenedObj);
          });
          canvas.renderAll();
        });
      });
    } catch (error) {
      console.error('Error parsing clipboard data:', error);
    }
  }
};

export const handleDelete = (canvas: Canvas, deleteShapeFromStorage: (id: string) => void) => {
  const activeObjects = canvas.getActiveObjects();

  if (!activeObjects || activeObjects.length === 0) {
    return;
  }

  if (activeObjects.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    activeObjects.forEach((obj: CustomFabricObject<any>) => {
      if (!obj.objectId) {
        return;
      }
      canvas.remove(obj);
      deleteShapeFromStorage(obj.objectId);
    });
  }

  canvas.discardActiveObject();
  canvas.requestRenderAll();
};

/**
 * Handles editor keyboard shortcuts (copy / paste / cut / delete / undo / redo / select all / deselect / nudge).
 *
 * **Shortcuts**
 * - ⌘/Ctrl + C : Copy selected object(s)
 * - ⌘/Ctrl + V : Paste
 * - ⌘/Ctrl + X : Cut (copy + delete)
 * - ⌘/Ctrl + Z : Undo
 * - ⌘/Ctrl + ⇧ + Z or ⌘/Ctrl + Y : Redo
 * - ⌘/Ctrl + A : Select all selectable objects
 * - Delete / Backspace : Delete selection
 * - Escape : Deselect active object(s)
 * - Arrow keys (↑, ↓, ←, →) : Nudge selected object(s) by 1px (or 10px with Shift)
 * - '/' (unshifted) : Prevent browser quick-find (optional)
 *
 * Skips handling when the focused element is a form field or contentEditable.
 *
 * @param {HandleKeyDownDeps} - Object containing the keyboard event, canvas, and action callbacks.
 */
export const handleKeyDown = ({
  e,
  canvas,
  undo,
  redo,
  syncShapeInStorage,
  deleteShapeFromStorage,
}: HandleKeyDownDeps) => {
  // Ignore when typing inside editable elements
  if (isDomEditor(e.target) || isFabricEditing(canvas)) return;

  const mod = e.metaKey || e.ctrlKey;
  const { code, key, shiftKey } = e;

  const doCopy = () => handleCopy(canvas);
  const doPaste = () => handlePaste(canvas, syncShapeInStorage);
  const doDelete = () => handleDelete(canvas, deleteShapeFromStorage);

  if (mod) {
    switch (code) {
      case 'KeyA': {
        e.preventDefault();
        const objects = canvas
          .getObjects()
          .filter(obj => obj.selectable !== false && (obj as { evented?: boolean }).evented !== false);
        if (objects.length > 0) {
          canvas.discardActiveObject();
          if (objects.length === 1) {
            canvas.setActiveObject(objects[0]);
          } else {
            const sel = new ActiveSelection(objects, { canvas });
            canvas.setActiveObject(sel);
          }
          canvas.requestRenderAll();
        }
        return;
      }

      case 'KeyC':
        e.preventDefault();
        doCopy();
        return;

      case 'KeyV':
        e.preventDefault();
        doPaste();
        return;

      case 'KeyX':
        e.preventDefault();
        doCopy();
        doDelete();
        return;

      case 'KeyZ':
        e.preventDefault();
        if (shiftKey) {
          redo();
        } else {
          undo();
        }
        return;

      case 'KeyY':
        e.preventDefault();
        redo();
        return;
    }
  }

  switch (key) {
    case 'Escape':
      e.preventDefault();
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      return;

    case 'ArrowUp':
    case 'ArrowDown':
    case 'ArrowLeft':
    case 'ArrowRight': {
      const activeObject = canvas.getActiveObject();
      if (!activeObject) return;

      e.preventDefault();
      const step = shiftKey ? 10 : 1;
      let dx = 0;
      let dy = 0;

      if (key === 'ArrowUp') dy = -step;
      else if (key === 'ArrowDown') dy = step;
      else if (key === 'ArrowLeft') dx = -step;
      else if (key === 'ArrowRight') dx = step;

      activeObject.set({
        left: (activeObject.left ?? 0) + dx,
        top: (activeObject.top ?? 0) + dy,
      });
      activeObject.setCoords();
      canvas.requestRenderAll();

      if ((activeObject as { getObjects?: () => FabricObject[] }).getObjects) {
        (activeObject as { getObjects: () => FabricObject[] }).getObjects().forEach(obj => syncShapeInStorage(obj));
      } else {
        syncShapeInStorage(activeObject);
      }
      return;
    }

    case 'Delete':
    case 'Backspace':
      e.preventDefault();
      doDelete();
      return;

    case '/':
      if (!shiftKey) e.preventDefault();
      return;
  }
};
