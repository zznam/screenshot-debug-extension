import { beforeEach, describe, expect, it, vi } from 'vitest';

import { exportRecordingVideo } from './export-video.util';
import { trimBlobWithFfmpeg } from './video-trim.util';

vi.mock('./video-trim.util', () => ({ trimBlobWithFfmpeg: vi.fn() }));

const encode = vi.mocked(trimBlobWithFfmpeg);

describe('recording video export', () => {
  beforeEach(() => {
    encode.mockReset();
  });

  it('downloads a full WebM in seconds without loading the encoder or changing its bytes', async () => {
    const input = new Blob(['original recording bytes'], { type: 'video/webm' });
    const result = await exportRecordingVideo(input, 12, {
      format: 'webm',
      trim: { start: 0, end: 12 },
      filenameBase: 'checkout',
    });
    expect(encode).not.toHaveBeenCalled();
    expect(result.blob).toBe(input);
    expect(await result.file.text()).toBe(await input.text());
    expect(result.file.name).toBe('checkout.webm');
    expect(result.meta).toEqual({
      format: 'webm',
      mime: 'video/webm',
      start: 0,
      end: 12,
      duration: 12,
      sizeBytes: input.size,
    });
  });

  it('supplies the WebM type for a full recording whose Blob type is empty', async () => {
    const input = new Blob(['recording bytes']);
    const result = await exportRecordingVideo(input, 12, { format: 'webm', trim: { start: 0, end: 12 } });
    expect(encode).not.toHaveBeenCalled();
    expect(result.blob.type).toBe('video/webm');
    expect(await result.blob.text()).toBe(await input.text());
  });

  it.each([
    { start: 2, end: 8 },
    { start: 0, end: 0.012 },
  ])('encodes a real trim instead of exporting the full recording: %j', async trim => {
    const input = new Blob(['original recording'], { type: 'video/webm' });
    const output = new Blob(['trimmed recording'], { type: 'video/webm' });
    encode.mockResolvedValue(output);
    const result = await exportRecordingVideo(input, 12, { format: 'webm', trim });
    expect(encode).toHaveBeenCalledExactlyOnceWith(input, trim, { format: 'webm' });
    expect(result.blob).toBe(output);
    expect(result.meta).toMatchObject({ start: trim.start, end: trim.end, duration: trim.end - trim.start });
  });

  it.each([
    { inputType: 'video/webm', format: 'mp4' as const },
    { inputType: 'video/mp4', format: 'webm' as const },
  ])('encodes full recordings when converting $inputType to $format', async ({ inputType, format }) => {
    const input = new Blob(['original recording'], { type: inputType });
    const output = new Blob(['converted recording'], { type: `video/${format}` });
    encode.mockResolvedValue(output);
    const trim = { start: 0, end: 12 };
    const result = await exportRecordingVideo(input, 12, { format, trim });
    expect(encode).toHaveBeenCalledExactlyOnceWith(input, trim, { format });
    expect(result.blob).toBe(output);
    expect(result.file.type).toBe(`video/${format}`);
    expect(result.meta).toMatchObject({ format, mime: `video/${format}`, duration: 12 });
  });
});
