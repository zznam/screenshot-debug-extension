import { FFmpeg } from '@ffmpeg/ffmpeg';

import type { TrimRange, VideoFormat } from '@src/models';

interface TrimOptions {
  format?: VideoFormat;
  accurate?: boolean;
  onLog?: (message: string) => void;
  onProgress?: (progress: number) => void;
}

const LOAD_TIMEOUT = 30_000;
const ENCODE_TIMEOUT = 120_000;
const fmt = (seconds: number) => seconds.toFixed(3);
const withTimeout = async <T>(promise: Promise<T>, milliseconds: number, message: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};

export const trimBlobWithFfmpeg = async (input: Blob, trim: TrimRange, options: TrimOptions = {}) => {
  const { format = 'webm', accurate = false } = options;
  if (!Number.isFinite(trim.start) || !Number.isFinite(trim.end) || trim.start < 0 || trim.end - trim.start <= 0.05)
    throw new Error('Choose a valid trim range longer than 0.05 seconds.');
  if (!input.size) throw new Error('The recording is empty.');
  if (format !== 'webm' && format !== 'mp4') throw new Error('Choose WebM or MP4 for the export.');

  const start = trim.start;
  const duration = trim.end - start;
  const ffmpeg = new FFmpeg();
  const request = new AbortController();
  let workerUrl: string | undefined;
  try {
    ffmpeg.on('log', ({ message }) => options.onLog?.(message));
    ffmpeg.on('progress', ({ progress }) => {
      if (Number.isFinite(progress)) options.onProgress?.(Math.max(0, Math.min(1, progress)));
    });
    const asset = (file: string) => chrome.runtime.getURL(`content-ui/ffmpeg/${file}`);
    // Content scripts run on the page's origin, so their worker entry needs a blob URL.
    // The build bundles its relative imports; the core and WASM remain packaged extension assets.
    const worker = await withTimeout(
      (async () => {
        const response = await fetch(asset('ffmpeg-worker.js'), { signal: request.signal });
        if (!response.ok) throw new Error('The local video encoder is missing. Rebuild or reinstall the extension.');
        return await response.blob();
      })(),
      LOAD_TIMEOUT,
      'Loading the local video encoder timed out. Try exporting again.',
    );
    workerUrl = URL.createObjectURL(new Blob([worker], { type: 'text/javascript' }));
    await withTimeout(
      ffmpeg.load({
        coreURL: asset('ffmpeg-core.js'),
        wasmURL: asset('ffmpeg-core.wasm'),
        classWorkerURL: workerUrl,
      }),
      LOAD_TIMEOUT,
      'The local video encoder could not start. Try another page or export the full WebM recording.',
    );

    const inputName = input.type.includes('mp4') ? 'input.mp4' : 'input.webm';
    const outputName = `output.${format}`;
    await withTimeout(
      ffmpeg.writeFile(inputName, new Uint8Array(await input.arrayBuffer())),
      LOAD_TIMEOUT,
      'Preparing the recording for export timed out.',
    );
    const copyWebm = ['-ss', fmt(start), '-t', fmt(duration), '-i', inputName, '-map', '0', '-c', 'copy'];
    const encode = [
      '-i',
      inputName,
      '-ss',
      fmt(start),
      '-t',
      fmt(duration),
      '-vf',
      "scale='trunc(min(1280,iw)/2)*2':-2,format=yuv420p",
      '-threads',
      '1',
      ...(format === 'mp4'
        ? [
            '-c:v',
            'libx264',
            '-preset',
            accurate ? 'veryfast' : 'ultrafast',
            '-crf',
            '23',
            '-c:a',
            'aac',
            '-b:a',
            '128k',
            '-movflags',
            '+faststart',
          ]
        : [
            '-c:v',
            'libvpx-vp9',
            '-b:v',
            '0',
            '-crf',
            '33',
            '-deadline',
            'realtime',
            '-cpu-used',
            '6',
            '-c:a',
            'libopus',
          ]),
    ];
    const args = [...(format === 'webm' && !accurate && input.type.includes('webm') ? copyWebm : encode), outputName];
    const exitCode = await withTimeout(
      ffmpeg.exec(args, ENCODE_TIMEOUT),
      ENCODE_TIMEOUT + 5_000,
      'Video export timed out. Try a shorter trim range.',
    );
    if (exitCode !== 0) throw new Error('Video export failed. Try a shorter trim range or export the original WebM.');
    const output = await withTimeout(
      ffmpeg.readFile(outputName),
      LOAD_TIMEOUT,
      'Reading the exported video timed out.',
    );
    if (!(output instanceof Uint8Array) || !output.byteLength)
      throw new Error('The video encoder produced empty output.');
    return new Blob([Uint8Array.from(output)], { type: `video/${format}` });
  } finally {
    request.abort();
    // Each export has its own worker and in-memory filesystem; termination releases both.
    // Never await file deletion here: a crashed worker cannot answer cleanup messages.
    ffmpeg.terminate();
    if (workerUrl) URL.revokeObjectURL(workerUrl);
  }
};
