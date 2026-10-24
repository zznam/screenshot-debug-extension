import { createWorker } from 'tesseract.js';
import type { Worker } from 'tesseract.js';

const recognizeImages = async (
  images: Blob[],
  progress: (value: string) => void,
  signal: AbortSignal,
): Promise<string[]> => {
  const base = chrome.runtime.getURL('library/ocr');
  let worker: Worker | undefined;
  let finished = false;
  let cancel: () => void = () => {};
  const cancelled = new Promise<never>((_, reject) => {
    cancel = () => reject(new Error('Text recognition cancelled.'));
    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) cancel();
  });
  const process = async () => {
    progress('Starting local English text recognition…');
    worker = await createWorker('eng', 1, {
      workerPath: `${base}/worker.min.js`,
      corePath: base,
      langPath: base,
      workerBlobURL: false,
      cacheMethod: 'none',
      logger: message => {
        if (!finished && !signal.aborted) progress(`${message.status} ${Math.round(message.progress * 100)}%`);
      },
    });
    if (finished || signal.aborted) {
      await worker.terminate();
      throw new Error('Text recognition cancelled.');
    }
    const texts: string[] = [];
    for (const [index, blob] of images.entries()) {
      if (signal.aborted) throw new Error('Text recognition cancelled.');
      progress(`Reading screenshot ${index + 1} of ${images.length}…`);
      const result = await worker.recognize(blob);
      texts.push(result.data.text.slice(0, 100_000));
    }
    return texts;
  };
  try {
    return await Promise.race([process(), cancelled]);
  } finally {
    finished = true;
    signal.removeEventListener('abort', cancel);
    await worker?.terminate();
  }
};

export { recognizeImages };
