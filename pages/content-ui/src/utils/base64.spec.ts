import { describe, expect, it } from 'vitest';

import { base64ToBlob } from './base64-to-blob.util';
import { base64ToFile } from './base64-to-file.util';

describe('base64 utils', () => {
  const sampleBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const pngDataUrl = `data:image/png;base64,${sampleBase64}`;
  const jpegDataUrl = `data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=`;

  it('converts PNG data URL to blob with image/png MIME type', () => {
    const blob = base64ToBlob(pngDataUrl);
    expect(blob.type).toBe('image/png');
    expect(blob.size).toBeGreaterThan(0);
  });

  it('converts JPEG data URL to blob with image/jpeg MIME type', () => {
    const blob = base64ToBlob(jpegDataUrl);
    expect(blob.type).toBe('image/jpeg');
    expect(blob.size).toBeGreaterThan(0);
  });

  it('converts raw base64 payload to blob with fallback MIME type', () => {
    const blob = base64ToBlob(sampleBase64, 'image/png');
    expect(blob.type).toBe('image/png');
    expect(blob.size).toBeGreaterThan(0);
  });

  it('converts PNG data URL to File with correct filename and type', () => {
    const file = base64ToFile(pngDataUrl, 'test-capture');
    expect(file.name).toBe('test-capture.png');
    expect(file.type).toBe('image/png');
    expect(file.size).toBeGreaterThan(0);
  });

  it('does not duplicate extension if filename already ends with extension', () => {
    const file = base64ToFile(pngDataUrl, 'already-named.png');
    expect(file.name).toBe('already-named.png');
  });

  it('converts JPEG data URL to File with jpeg extension and type', () => {
    const file = base64ToFile(jpegDataUrl, 'camera');
    expect(file.name).toBe('camera.jpeg');
    expect(file.type).toBe('image/jpeg');
  });
});
