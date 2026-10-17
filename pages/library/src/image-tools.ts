interface Mask {
  x: number;
  y: number;
  width: number;
  height: number;
}

const loadImage = async (blob: Blob): Promise<ImageBitmap> => createImageBitmap(blob);

const flattenImage = async (blob: Blob, masks: Mask[] = []): Promise<Blob> => {
  const image = await loadImage(blob);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image rendering is unavailable.');
    context.drawImage(image, 0, 0);
    context.fillStyle = '#000';
    for (const mask of masks) {
      if (![mask.x, mask.y, mask.width, mask.height].every(Number.isFinite)) throw new Error('Invalid privacy mask.');
      // Round outwards so partial pixels cannot reveal the edge of a covered area.
      const x = Math.floor(mask.x * image.width);
      const y = Math.floor(mask.y * image.height);
      context.fillRect(
        x,
        y,
        Math.ceil((mask.x + mask.width) * image.width) - x,
        Math.ceil((mask.y + mask.height) * image.height) - y,
      );
    }
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(value => (value ? resolve(value) : reject(new Error('Could not render image.'))), 'image/png'),
    );
  } finally {
    image.close();
  }
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  // Give Chrome time to consume the object URL before releasing the image bytes.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

const comparePixels = (before: Uint8ClampedArray, after: Uint8ClampedArray, tolerance = 24) => {
  if (before.length !== after.length || before.length % 4) throw new Error('Images must have matching dimensions.');
  const pixels = new Uint8ClampedArray(before.length);
  let changed = 0;
  for (let index = 0; index < before.length; index += 4) {
    const different = [0, 1, 2, 3].some(
      channel => Math.abs(before[index + channel]! - after[index + channel]!) > tolerance,
    );
    if (different) changed++;
    pixels[index] = different ? 230 : Math.round(before[index]! * 0.25);
    pixels[index + 1] = different ? 40 : Math.round(before[index + 1]! * 0.25);
    pixels[index + 2] = different ? 110 : Math.round(before[index + 2]! * 0.25);
    pixels[index + 3] = 255;
  }
  return { pixels, percent: before.length ? (changed / (before.length / 4)) * 100 : 0 };
};

export { comparePixels, downloadBlob, flattenImage, loadImage };
export type { Mask };
