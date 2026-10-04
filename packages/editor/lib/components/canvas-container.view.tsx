import type { Canvas, FabricObject, PencilBrush } from 'fabric';
import { saveAs } from 'file-saver';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { Screenshot } from '@extension/shared';
import { captureSettingsStorage } from '@extension/storage';
import { Button, Icon, toast } from '@extension/ui';

import { CanvasWrapper } from './canvas-wrapper.view';
import { Toolbar } from './ui';
import { defaultNavElement } from '../constants/annotation-elements';
import type { ActiveElement, Attributes } from '../models/annotation.model';
import { useEditorSession } from '../session-context';
import { applyBrush, DRAWING_TOOLS } from '../utils/annotation/canvas.util';
import {
  handleCanvasMouseMove,
  handleCanvasMouseDown,
  handleCanvasMouseUp,
  handleCanvasObjectModified,
  handleCanvasObjectMoving,
  handleCanvasObjectScaling,
  handleCanvasSelectionCreated,
  handleDelete,
  handleKeyDown,
  handlePathCreated,
  initializeFabric,
  setCanvasBackground,
  modifyShape,
  hexToRgba,
} from '../utils/annotation/index';
import { encodeScreenshot } from '../utils/encode-screenshot.util';
import { base64ToFile } from '../utils/index';

interface CanvasContainerProps {
  screenshot: Screenshot;
  onElement: (elem: ActiveElement) => void;
  onAiRendererReady?: (renderer: (() => string) | null) => void;
}

const CanvasContainerView = ({ screenshot, onElement, onAiRendererReady }: CanvasContainerProps) => {
  const {
    session,
    command: { type: lastAction, tick },
  } = useEditorSession();
  const { annotationsStorage } = session;

  const gridCellRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const processedTick = useRef(tick);
  const [actionMenuVisible, setActionMenuVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ left: 0, top: 0 });

  /**
   * useStorage is a hook provided by local store that allows you to store
   * data in a key-value store and automatically sync it with other users
   * i.e., subscribes to updates to that selected data
   *
   * Over here, we are storing the canvas objects in the key-value store.
   */

  /**
   * canvasRef is a reference to the canvas element that we'll use to initialize
   * the fabric canvas.
   *
   * fabricRef is a reference to the fabric canvas that we use to perform
   * operations on the canvas. It's a copy of the created canvas so we can use
   * it outside the canvas event listeners.
   */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);

  /**
   * isDrawing is a boolean that tells us if the user is drawing on the canvas.
   * We use this to determine if the user is drawing or not
   * i.e., if the freeform drawing mode is on or not.
   */
  const isDrawing = useRef(false);

  /**
   * shapeRef is a reference to the shape that the user is currently drawing.
   * We use this to update the shape's properties when the user is
   * drawing/creating shape
   */
  const shapeRef = useRef<FabricObject | null>(null);

  /**
   * selectedShapeRef is a reference to the shape that the user has selected.
   * For example, if the user has selected the rectangle shape, then this will
   * be set to "rectangle".
   *
   * We're using refs here because we want to access these variables inside the
   * event listeners. We don't want to lose the values of these variables when
   * the component re-renders. Refs help us with that.
   */
  const selectedShapeRef = useRef<string | null>(null);

  /**
   * activeObjectRef is a reference to the active/selected object in the canvas
   *
   * We want to keep track of the active object so that we can keep it in
   * selected form when user is editing the width, height, color etc
   * properties/attributes of the object.
   *
   * Since we're using live storage to sync shapes across users in real-time,
   * we have to re-render the canvas when the shapes are updated.
   * Due to this re-render, the selected shape is lost. We want to keep track
   * of the selected shape so that we can keep it selected when the
   * canvas re-renders.
   */
  const activeObjectRef = useRef<FabricObject | null>(null);
  const isEditingRef = useRef(false);

  /**
   * imageInputRef is a reference to the input element that we use to upload
   * an image to the canvas.
   *
   * We want image upload to happen when clicked on the image item from the
   * dropdown menu. So we're using this ref to trigger the click event on the
   * input element when the user clicks on the image item from the dropdown.
   */
  const imageInputRef = useRef<HTMLInputElement>(null);

  /**
   * activeElement is an object that contains the name, value and icon of the
   * active element in the navbar.
   */
  const [activeElement, setActiveElement] = useState<ActiveElement>(defaultNavElement);

  /**
   * elementAttributes is an object that contains the attributes of the selected
   * element in the canvas.
   *
   * We use this to update the attributes of the selected element when the user
   * is editing the width, height, color etc properties/attributes of the
   * object.
   */

  const [elementAttributes, setElementAttributes] = useState<Attributes>({
    width: '',
    height: '',
    fontSize: '',
    fontFamily: '',
    fontWeight: '',
    fill: '',
    stroke: '#ef4444',
  });
  const currentColorRef = useRef<string>('#ef4444');

  /**
   * useUndo and useRedo are hooks provided by local store that allow you to
   * undo and redo mutations.
   */

  const restoreObjects = useCallback(
    async (canvas: Canvas, snapshot: { objects: unknown[] }) => {
      await canvas.loadFromJSON(snapshot);
      const frame = gridCellRef.current?.getBoundingClientRect();
      const meta = await setCanvasBackground({
        file: screenshot.src,
        canvas,
        parentWidth: frame?.width || canvas.getWidth(),
        parentHeight: frame?.height || canvas.getHeight(),
      });
      await annotationsStorage.setAnnotations(screenshot.id!, { meta });
    },
    [annotationsStorage, screenshot.id, screenshot.src],
  );
  const restoring = useRef(false);
  const restoreHistory = useCallback(
    async (direction: 'undo' | 'redo') => {
      if (!fabricRef.current || restoring.current) return;
      restoring.current = true;
      try {
        const snapshot = session[direction](screenshot.id!);
        if (snapshot) await restoreObjects(fabricRef.current, snapshot);
      } finally {
        restoring.current = false;
      }
    },
    [restoreObjects, screenshot.id, session],
  );
  const undo = useCallback(() => restoreHistory('undo'), [restoreHistory]);
  const redo = useCallback(() => restoreHistory('redo'), [restoreHistory]);

  /**
   * deleteShapeFromStorage is a mutation that deletes a shape from the
   * key-value store of local store.
   * useMutation is a hook provided by local store that allows you to perform
   * mutations on local store data.
   *
   * We're using this mutation to delete a shape from the key-value store when
   * the user deletes a shape from the canvas.
   */
  const deleteShapeFromStorage = useCallback(() => {
    if (fabricRef.current) session.record(screenshot.id!, fabricRef.current.toJSON().objects ?? []);
  }, [screenshot.id, session]);

  const deleteAllShapes = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas || restoring.current) return;
    canvas.getObjects().forEach(object => canvas.remove(object));
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    session.record(screenshot.id!, []);
  }, [screenshot.id, session]);

  const syncShapeInStorage = useCallback(() => {
    if (fabricRef.current && !restoring.current)
      session.record(screenshot.id!, fabricRef.current.toJSON().objects ?? []);
  }, [screenshot.id, session]);

  /**
   * Set the active element in the navbar and perform the action based
   * on the selected element.
   *
   * @param elem
   */
  const handleActiveElement = (elem: ActiveElement) => {
    if (restoring.current) return;
    if (elem?.value === 'color-palette') {
      const highlighterColor = hexToRgba(elem?.payload?.color || elementAttributes.stroke, 0.45);

      currentColorRef.current = elem?.payload?.color || elementAttributes.stroke;

      if (fabricRef.current?.isDrawingMode) {
        (fabricRef.current.freeDrawingBrush as PencilBrush).color = highlighterColor;
      }

      setElementAttributes(prevAttributes => ({
        ...prevAttributes,
        stroke: highlighterColor,
      }));

      modifyShape({
        canvas: fabricRef.current!,
        property: 'stroke',
        value: highlighterColor,
        activeObjectRef,
        syncShapeInStorage,
      });

      return;
    }

    setActiveElement(elem);
    onElement(elem);

    switch (elem?.value) {
      case 'undo':
        undo();
        break;

      case 'redo':
        redo();
        break;

      // delete all the shapes from the canvas
      case 'start_over':
        // clear the storage
        deleteAllShapes();
        // clear the canvas
        // set "select" as the active element
        setActiveElement(defaultNavElement);
        break;

      // delete the selected shape from the canvas
      case 'delete':
        // delete it from the canvas
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        handleDelete(fabricRef.current as any, deleteShapeFromStorage);
        // set "select" as the active element
        setActiveElement(defaultNavElement);
        break;

      // upload an image to the canvas
      case 'image':
        // trigger the click event on the input element which opens the file dialog
        imageInputRef.current?.click();
        /**
         * set drawing mode to false
         * If the user is drawing on the canvas, we want to stop the
         * drawing mode when clicked on the image item from the dropdown.
         */
        isDrawing.current = false;

        if (fabricRef.current) {
          // disable the drawing mode of canvas
          fabricRef.current.isDrawingMode = false;
        }
        break;

      default:
        if (fabricRef.current) {
          if (DRAWING_TOOLS.includes(elem?.value || '')) {
            isDrawing.current = true;
            fabricRef.current.isDrawingMode = true;

            applyBrush(elem?.value as 'freeform' | 'highlighter', fabricRef.current, currentColorRef);
          } else {
            isDrawing.current = false;
            fabricRef.current.isDrawingMode = false;
          }
        }

        selectedShapeRef.current = elem?.value as string;

        break;
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateMenuPosition = useCallback((options: any) => {
    const obj = options.selected ? options.selected[0] : fabricRef.current!.getActiveObject();
    if (!obj) return;

    const { left, top, width, height } = obj.getBoundingRect(false, true);

    const vpt = fabricRef.current!.viewportTransform!;
    const vx = vpt[0] * (left + width / 2) + vpt[4];
    const vy = vpt[3] * (top + height) + vpt[5];

    setMenuPosition({
      left: vx + 100,
      top: vy + 40,
    });
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onChangeSelection = useCallback((options: any) => {
    if (!options?.selected) {
      return;
    }

    setActionMenuVisible(true);
  }, []);

  useEffect(() => {
    if (!lastAction || !ready || processedTick.current === tick) return;
    processedTick.current = tick;

    switch (lastAction) {
      case 'UNDO':
        undo();
        break;
      case 'REDO':
        redo();
        break;
      case 'START_OVER':
        deleteAllShapes();
        break;
    }
  }, [deleteAllShapes, lastAction, ready, redo, tick, undo]);

  useEffect(() => {
    if (!screenshot?.id) {
      return;
    }

    const canvas = initializeFabric({
      canvasRef,
      fabricRef,
      backgroundImage: screenshot?.src,
    });

    let disposed = false;
    setReady(false);
    restoring.current = true;
    const initialize = async () => {
      const annotations = await annotationsStorage.getAnnotations(screenshot.id!);
      if (disposed) return;
      await restoreObjects(canvas, annotations ?? { objects: [] });
      if (disposed) return;
      restoring.current = false;
      setReady(true);
      onAiRendererReady?.(() => {
        const scale = canvas.viewportTransform?.[0] || 1;
        return canvas.toDataURL({ format: 'png', multiplier: 1 / scale });
      });
    };
    void initialize().catch(error => {
      if (!disposed) toast.error(error instanceof Error ? error.message : 'Could not open this image.');
    });

    /**
     * listen to the mouse down event on the canvas which is fired when the
     * user clicks on the canvas
     *
     * Event inspector: http://fabricjs.com/events
     * Event list: http://fabricjs.com/docs/fabric.Canvas.html#fire
     */
    canvas.on('mouse:down', options => {
      handleCanvasMouseDown({
        options,
        canvas,
        selectedShapeRef,
        isDrawing,
        shapeRef,
        currentColorRef,
      });

      if (!options.target) {
        setActionMenuVisible(false);
      }
    });

    /**
     * listen to the mouse move event on the canvas which is fired when the
     * user moves the mouse on the canvas
     *
     * Event inspector: http://fabricjs.com/events
     * Event list: http://fabricjs.com/docs/fabric.Canvas.html#fire
     */
    canvas.on('mouse:move', options => {
      handleCanvasMouseMove({
        options,
        canvas,
        isDrawing,
        selectedShapeRef,
        shapeRef,
        syncShapeInStorage,
      });
    });

    /**
     * listen to the mouse up event on the canvas which is fired when the
     * user releases the mouse on the canvas
     *
     * Event inspector: http://fabricjs.com/events
     * Event list: http://fabricjs.com/docs/fabric.Canvas.html#fire
     */
    canvas.on('mouse:up', () => {
      handleCanvasMouseUp({
        canvas,
        isDrawing,
        shapeRef,
        activeObjectRef,
        selectedShapeRef,
        syncShapeInStorage,
        setActiveElement,
      });
    });

    /**
     * listen to the path created event on the canvas which is fired when
     * the user creates a path on the canvas using the freeform drawing
     * mode
     *
     * Event inspector: http://fabricjs.com/events
     * Event list: http://fabricjs.com/docs/fabric.Canvas.html#fire
     */
    canvas.on('path:created', options => {
      handlePathCreated({
        options,
        syncShapeInStorage,
      });
    });

    /**
     * listen to the object modified event on the canvas which is fired
     * when the user modifies an object on the canvas. Basically, when the
     * user changes the width, height, color etc properties/attributes of
     * the object or moves the object on the canvas.
     *
     * Event inspector: http://fabricjs.com/events
     * Event list: http://fabricjs.com/docs/fabric.Canvas.html#fire
     */
    canvas.on('object:modified', options => {
      handleCanvasObjectModified({
        options,
        syncShapeInStorage,
      });
    });

    /**
     * listen to the object moving event on the canvas which is fired
     * when the user moves an object on the canvas.
     *
     * Event inspector: http://fabricjs.com/events
     * Event list: http://fabricjs.com/docs/fabric.Canvas.html#fire
     */
    canvas?.on('object:moving', options => {
      handleCanvasObjectMoving({
        options,
      });

      updateMenuPosition(options);
    });

    /**
     * listen to the selection created event on the canvas which is fired
     * when the user selects an object on the canvas.
     *
     * Event inspector: http://fabricjs.com/events
     * Event list: http://fabricjs.com/docs/fabric.Canvas.html#fire
     */
    canvas.on('selection:created', options => {
      handleCanvasSelectionCreated({
        options,
        isEditingRef,
        setElementAttributes,
      });

      onChangeSelection(options);

      updateMenuPosition(options);
    });

    canvas.on('selection:updated', options => {
      onChangeSelection(options);

      updateMenuPosition(options);
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    canvas.on('selection:cleared', options => {
      setActionMenuVisible(false);
    });
    /**
     * listen to the scaling event on the canvas which is fired when the
     * user scales an object on the canvas.
     *
     * Event inspector: http://fabricjs.com/events
     * Event list: http://fabricjs.com/docs/fabric.Canvas.html#fire
     */
    canvas.on('object:scaling', options => {
      handleCanvasObjectScaling({
        options,
        setElementAttributes,
      });

      updateMenuPosition(options);
    });

    canvas.on('object:rotating', options => {
      updateMenuPosition(options);
    });

    /**
     * listen to the mouse wheel event on the canvas which is fired when
     * the user scrolls the mouse wheel on the canvas.
     *
     * Event inspector: http://fabricjs.com/events
     * Event list: http://fabricjs.com/docs/fabric.Canvas.html#fire
     */
    canvas.on('mouse:wheel', () => {
      // handleCanvasZoom({
      //   options,
      //   canvas,
      // });
    });

    /**
     * listen to the resize event on the window which is fired when the
     * user resizes the window.
     *
     * We're using this to resize the canvas when the user resizes the
     * window.
     */
    const frame = gridCellRef.current!;
    const resize = async () => {
      if (disposed || restoring.current) return;
      const rect = frame.getBoundingClientRect();
      const meta = await setCanvasBackground({
        file: screenshot.src,
        canvas,
        parentWidth: rect.width,
        parentHeight: rect.height,
      });
      if (!disposed) await annotationsStorage.setAnnotations(screenshot.id!, { meta });
    };
    const observer = new ResizeObserver(() => {
      void resize();
    });
    observer.observe(frame);
    const keyboardRoot = canvasRef.current!.getRootNode();
    const keydown = (event: Event) => {
      if (disposed || restoring.current) return;
      handleKeyDown({ e: event as KeyboardEvent, canvas, undo, redo, syncShapeInStorage, deleteShapeFromStorage });
    };
    keyboardRoot.addEventListener('keydown', keydown);
    return () => {
      disposed = true;
      onAiRendererReady?.(null);
      observer.disconnect();
      keyboardRoot.removeEventListener('keydown', keydown);
      void canvas.dispose();
      fabricRef.current = null;
    };
  }, [
    annotationsStorage,
    deleteShapeFromStorage,
    onAiRendererReady,
    onChangeSelection,
    redo,
    restoreObjects,
    screenshot.id,
    screenshot.src,
    session,
    syncShapeInStorage,
    undo,
    updateMenuPosition,
  ]);

  const handleOnExportScreenshot = async (format: string = 'png') => {
    try {
      const canvas = fabricRef.current;
      const scale = canvas?.viewportTransform?.[0] || 1;
      const src = canvas?.toDataURL({ format: 'png', multiplier: 1 / scale }) ?? screenshot.src;
      const settings = await captureSettingsStorage.get();
      const outputFormat = format === 'jpeg' ? 'jpeg' : 'png';
      const encoded = await encodeScreenshot(src, outputFormat, settings.screenshotQuality);
      const name = screenshot.name || 'screenshot';
      const file = base64ToFile(encoded, name);
      saveAs(file, `${name}.${outputFormat}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not export the screenshot.');
    }
  };

  const handleOnRemove = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handleActiveElement({ value: 'delete' } as any);

    setActionMenuVisible(false);
  };

  return (
    <div data-editor-ready={ready} aria-busy={!ready} className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      <div ref={gridCellRef} className="flex min-h-0 w-full flex-1 items-center justify-center">
        <CanvasWrapper
          id={screenshot?.id || ''}
          canvasRef={canvasRef}
          onUndo={undo}
          onRedo={redo}
          onStartOver={deleteAllShapes}
          onExport={handleOnExportScreenshot}
        />
      </div>

      {actionMenuVisible && (
        <div id="actions-menu" className="absolute" style={{ left: menuPosition.left, top: menuPosition.top }}>
          <Button
            type="button"
            size="icon"
            aria-label="Delete annotation"
            className="hover:bg-accent size-7"
            variant="secondary"
            onClick={handleOnRemove}>
            <Icon name="TrashIcon" className="size-4" />
          </Button>
        </div>
      )}

      <Toolbar
        activeElement={activeElement}
        onActiveElement={handleActiveElement}
        onExport={handleOnExportScreenshot}
      />
    </div>
  );
};

export default CanvasContainerView;
