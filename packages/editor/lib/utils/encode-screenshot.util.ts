import type { ScreenshotFormat } from '@extension/storage';

export const encodeScreenshot = async (src: string, format: ScreenshotFormat, quality = 100): Promise<string> => {
  const image = new Image();
  image.src = src;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d');
  if (!context || !canvas.width || !canvas.height) throw new Error('Could not prepare the screenshot image.');
  if (format === 'jpeg') {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  context.drawImage(image, 0, 0);
  return canvas.toDataURL(`image/${format}`, Math.max(0.5, Math.min(1, quality / 100)));
};
