import type { FabricObject, Rect } from 'fabric';
import { Canvas, util as FabricUtil, FabricImage, filters as FabricFilters } from 'fabric';

import type { Screenshot } from '@extension/shared';

/**
 * Renders a screenshot *with* its annotations into a PNG Blob
 * without flashing anything on-screen.
 *
 * @param screenshot   the screenshot (src must be CORS-enabled)
 * @param objects JSON objects from annotationsStorage
 */
export const mergeScreenshot = async ({
  screenshot,
  objects,
  parentWidth,
  parentHeight,
}: {
  screenshot: Screenshot;
  objects: FabricObject[];
  parentWidth: number;
  parentHeight: number;
}): Promise<File> => {
  const bg = await FabricImage.fromURL(screenshot.src, { crossOrigin: 'anonymous' });
  const scale = Math.min(parentWidth / bg.width!, parentHeight / bg.height!, 1);
  const canvasEl = document.createElement('canvas');
  const canvas = new Canvas(canvasEl, { renderOnAddRemove: false });

  canvas.setDimensions({ width: Math.round(bg.width! * scale), height: Math.round(bg.height! * scale) });
  canvas.setViewportTransform([scale, 0, 0, scale, 0, 0]);
  canvas.backgroundImage = bg;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blurRects = objects.filter((o: any) => o.shapeType === 'blur');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const normals = objects.filter((o: any) => o.shapeType !== 'blur');

  const enlivened = await FabricUtil.enlivenObjects(normals);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  enlivened.forEach((obj: any) => canvas.add(obj));

  for (const snap of blurRects) {
    const [rect] = (await FabricUtil.enlivenObjects([snap])) as [Rect];

    rect.absolutePositioned = true;

    const patch = bg.cloneAsImage({});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    patch.filters = [new FabricFilters.Blur({ blur: (snap as any).blurRadius ?? 12 })];
    patch.applyFilters();
    patch.clipPath = rect;

    canvas.add(patch);
  }

  canvas.requestRenderAll();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blob: any = await canvas.toBlob();

  canvas.dispose();

  return new File([blob], `${screenshot.name}.jpeg`, { type: 'image/jpeg' });
};
