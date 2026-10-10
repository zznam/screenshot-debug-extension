import { base64ToBlob } from './base64-to-blob.util';
import { encodeScreenshot } from './encode-screenshot.util';

export const copyBase64ImageToClipboard = async (b64: string): Promise<void> => {
  if (!('clipboard' in navigator) || typeof ClipboardItem === 'undefined') {
    throw new Error('Clipboard images are not supported in this browser.');
  }

  // Chrome's async Clipboard API only supports image/png for image writes.
  // Transcode any non-PNG image to PNG so clipboard copy works reliably for all screenshots.
  const isPng = b64.startsWith('data:image/png;') || b64.startsWith('data:image/png,');
  const pngDataUrl = isPng ? b64 : await encodeScreenshot(b64, 'png');
  const blob = base64ToBlob(pngDataUrl, 'image/png');
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
};
