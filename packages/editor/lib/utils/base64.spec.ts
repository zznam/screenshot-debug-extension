import { describe, expect, it } from 'vitest';

import { base64ToBlob } from './base64-to-blob.util.js';
import { base64ToFile } from './base64-to-file.util.js';

describe('base64 conversions', () => {
  const samplePngPayload =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jD1sAAAAASUVORK5CYII=';
  const samplePngDataUrl = `data:image/png;base64,${samplePngPayload}`;
  const sampleJpegDataUrl =
    'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

  describe('base64ToFile', () => {
    it('converts png data URL to a File with .png extension and correct mime type', () => {
      const file = base64ToFile(samplePngDataUrl, 'screenshot');
      expect(file.name).toBe('screenshot.png');
      expect(file.type).toBe('image/png');
      expect(file.size).toBeGreaterThan(0);
    });

    it('converts jpeg data URL to a File with .jpeg extension and correct mime type', () => {
      const file = base64ToFile(sampleJpegDataUrl, 'capture');
      expect(file.name).toBe('capture.jpeg');
      expect(file.type).toBe('image/jpeg');
      expect(file.size).toBeGreaterThan(0);
    });

    it('prevents duplicate extension when filename already has .jpg or .jpeg', () => {
      const file1 = base64ToFile(sampleJpegDataUrl, 'capture.jpg');
      expect(file1.name).toBe('capture.jpeg');
      const file2 = base64ToFile(sampleJpegDataUrl, 'capture.jpeg');
      expect(file2.name).toBe('capture.jpeg');
      const file3 = base64ToFile(samplePngDataUrl, 'screenshot.png');
      expect(file3.name).toBe('screenshot.png');
    });

    it('maps image/svg+xml to .svg extension', () => {
      const svgBase64 = 'data:image/svg+xml;base64,' + btoa('<svg></svg>');
      const file = base64ToFile(svgBase64, 'diagram');
      expect(file.name).toBe('diagram.svg');
      expect(file.type).toBe('image/svg+xml');
    });

    it('handles raw base64 payload defaulting to png', () => {
      const file = base64ToFile(samplePngPayload, 'raw-shot');
      expect(file.name).toBe('raw-shot.png');
      expect(file.type).toBe('image/png');
      expect(file.size).toBeGreaterThan(0);
    });

    it('safely handles repeated data: prefixes without polynomial backtracking', () => {
      const maliciousPrefix = 'data:' + 'data:a'.repeat(50) + ';base64,' + samplePngPayload;
      const file = base64ToFile(maliciousPrefix, 'redos-test');
      expect(file).toBeDefined();
    });
  });

  describe('base64ToBlob', () => {
    it('converts png data URL to a Blob with image/png type', () => {
      const blob = base64ToBlob(samplePngDataUrl);
      expect(blob.type).toBe('image/png');
      expect(blob.size).toBeGreaterThan(0);
    });

    it('converts jpeg data URL to a Blob with image/jpeg type', () => {
      const blob = base64ToBlob(sampleJpegDataUrl);
      expect(blob.type).toBe('image/jpeg');
      expect(blob.size).toBeGreaterThan(0);
    });

    it('converts raw base64 string to a Blob with custom fallback type', () => {
      const blob = base64ToBlob(samplePngPayload, 'image/webp');
      expect(blob.type).toBe('image/webp');
      expect(blob.size).toBeGreaterThan(0);
    });
  });
});
