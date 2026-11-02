import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { trimBlobWithFfmpeg } from './video-trim.util';

const encoder = vi.hoisted(() => ({
  load: vi.fn(),
  writeFile: vi.fn(),
  exec: vi.fn(),
  readFile: vi.fn(),
  terminate: vi.fn(),
  on: vi.fn(),
  create: vi.fn(),
}));
vi.mock('@ffmpeg/ffmpeg', () => ({
  FFmpeg: class {
    constructor() {
      encoder.create();
    }
    load = encoder.load;
    writeFile = encoder.writeFile;
    exec = encoder.exec;
    readFile = encoder.readFile;
    terminate = encoder.terminate;
    on = encoder.on;
  },
}));
const input = new Blob(['video'], { type: 'video/webm' });
const range = { start: 1, end: 2.5 };

beforeEach(() => {
  vi.resetAllMocks();
  encoder.load.mockResolvedValue(true);
  encoder.writeFile.mockResolvedValue(true);
  encoder.exec.mockResolvedValue(0);
  encoder.readFile.mockResolvedValue(new Uint8Array([1, 2, 3]));
  vi.stubGlobal('chrome', { runtime: { getURL: (path: string) => `chrome-extension://fixture/${path}` } });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('bundled worker', { status: 200 })));
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:worker');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('local recording encoder', () => {
  it('loads only packaged assets, encodes MP4 and releases the worker and blob URL', async () => {
    const output = await trimBlobWithFfmpeg(input, range, { format: 'mp4' });
    expect(output.type).toBe('video/mp4');
    expect(output.size).toBe(3);
    expect(encoder.load).toHaveBeenCalledWith({
      coreURL: 'chrome-extension://fixture/content-ui/ffmpeg/ffmpeg-core.js',
      wasmURL: 'chrome-extension://fixture/content-ui/ffmpeg/ffmpeg-core.wasm',
      classWorkerURL: 'blob:worker',
    });
    expect(encoder.exec.mock.calls[0]![0]).toEqual(
      expect.arrayContaining(['libx264', 'aac', '-movflags', '+faststart']),
    );
    expect(encoder.exec.mock.calls[0]![1]).toBe(120_000);
    expect(encoder.terminate).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:worker');
  });

  it('copies compatible WebM by default and encodes when accuracy or conversion requires it', async () => {
    vi.mocked(fetch).mockImplementation(async () => new Response('worker'));
    await trimBlobWithFfmpeg(input, range);
    expect(encoder.exec.mock.calls[0]![0]).toContain('copy');
    await trimBlobWithFfmpeg(input, range, { accurate: true });
    expect(encoder.exec.mock.calls[1]![0]).toContain('libvpx-vp9');
    await trimBlobWithFfmpeg(new Blob(['mp4'], { type: 'video/mp4' }), range, { accurate: false });
    expect(encoder.exec.mock.calls[2]![0]).toContain('libvpx-vp9');
  });

  it('attaches progress listeners for every export and clamps progress', async () => {
    const onProgress = vi.fn();
    const onLog = vi.fn();
    vi.mocked(fetch).mockImplementation(async () => new Response('worker'));
    await trimBlobWithFfmpeg(input, range, { onProgress, onLog });
    await trimBlobWithFfmpeg(input, range, { onProgress, onLog });
    const progressCallbacks = encoder.on.mock.calls.filter(([name]) => name === 'progress');
    expect(progressCallbacks).toHaveLength(2);
    progressCallbacks[0]![1]({ progress: 1.5 });
    progressCallbacks[1]![1]({ progress: Number.NaN });
    expect(onProgress).toHaveBeenCalledExactlyOnceWith(1);
    encoder.on.mock.calls.find(([name]) => name === 'log')![1]({ message: 'Encoding' });
    expect(onLog).toHaveBeenCalledWith('Encoding');
    expect(encoder.terminate).toHaveBeenCalledTimes(2);
  });

  it.each([
    { start: -1, end: 2 },
    { start: 2, end: 1 },
    { start: 1, end: 1.01 },
    { start: Number.NaN, end: 2 },
    { start: 0, end: Infinity },
  ])('validates range before allocating an encoder: %j', async invalid => {
    await expect(trimBlobWithFfmpeg(input, invalid)).rejects.toThrow('valid trim range');
    expect(encoder.create).not.toHaveBeenCalled();
  });

  it('rejects an empty recording without loading the encoder', async () => {
    await expect(trimBlobWithFfmpeg(new Blob([]), range)).rejects.toThrow('empty');
    expect(encoder.create).not.toHaveBeenCalled();
  });

  it('terminates after missing assets or rejected core initialization', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 404 }));
    await expect(trimBlobWithFfmpeg(input, range)).rejects.toThrow('encoder is missing');
    expect(encoder.terminate).toHaveBeenCalledOnce();
    vi.mocked(fetch).mockResolvedValueOnce(new Response('worker'));
    encoder.load.mockRejectedValueOnce(new Error('WASM denied'));
    await expect(trimBlobWithFfmpeg(input, range)).rejects.toThrow('WASM denied');
    expect(encoder.terminate).toHaveBeenCalledTimes(2);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:worker');
  });

  it('terminates a worker whose load never answers', async () => {
    vi.useFakeTimers();
    encoder.load.mockImplementation(() => new Promise(() => undefined));
    const task = trimBlobWithFfmpeg(input, range);
    const rejected = expect(task).rejects.toThrow('could not start');
    await vi.advanceTimersByTimeAsync(30_001);
    await rejected;
    expect(encoder.terminate).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:worker');
  });

  it('rejects encoder failures without reading nonexistent output or awaiting file cleanup', async () => {
    encoder.exec.mockResolvedValueOnce(1);
    await expect(trimBlobWithFfmpeg(input, range)).rejects.toThrow('export failed');
    expect(encoder.readFile).not.toHaveBeenCalled();
    expect(encoder.terminate).toHaveBeenCalledOnce();
  });

  it('rejects empty encoded output and still frees the worker', async () => {
    encoder.readFile.mockResolvedValueOnce(new Uint8Array());
    await expect(trimBlobWithFfmpeg(input, range)).rejects.toThrow('empty output');
    expect(encoder.terminate).toHaveBeenCalledOnce();
  });
});
