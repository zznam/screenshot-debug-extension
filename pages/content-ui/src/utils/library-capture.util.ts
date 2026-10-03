import type { FabricObject } from 'fabric';

import type {
  CaptureAnnotations,
  CaptureSnapshot,
  LibraryResponse,
  Screenshot,
  ScreenshotSavePayload,
} from '@extension/shared';
import { annotationsStorage, CHUNK_SIZE } from '@extension/storage';

import { mergeScreenshot } from './annotation/merge-screenshot.util';

type LibraryContext = Omit<CaptureSnapshot, 'diagnostics'>;
interface LibrarySaveSession {
  context?: Promise<LibraryContext>;
  revision: number;
  signature: string;
  title: string;
}
const createLibrarySaveSession = (): LibrarySaveSession => ({
  revision: 0,
  signature: '',
  title: 'Untitled report',
});
const sendLibrary = async <T>(message: Record<string, unknown>): Promise<T> => {
  const response = (await chrome.runtime.sendMessage(message)) as LibraryResponse<T> | undefined;
  if (!response || response.status !== 'success')
    throw new Error(response?.message ?? 'The library is unavailable. Try again.');
  return response.data;
};
const blobDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
const thumbnailFor = async (src: string) => {
  const image = new Image();
  image.src = src;
  await image.decode();
  const scale = Math.min(1, 320 / image.naturalWidth, 200 / image.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Cannot create a capture thumbnail.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.7);
};
const captureLibraryContext = () => sendLibrary<LibraryContext>({ type: 'LIBRARY:SNAPSHOT' });
const prepareLibrarySession = (session: LibrarySaveSession) => {
  session.context ??= captureLibraryContext().catch(cause => {
    session.context = undefined;
    throw cause;
  });
  return session.context;
};
const saveScreenshotsToLibrary = async ({
  context,
  revision,
  title,
  screenshots,
  activeId,
  renderActive,
  signal,
  onProgress,
}: {
  context: LibraryContext;
  revision: number;
  title: string;
  screenshots: Screenshot[];
  activeId: string;
  renderActive: (() => string) | null;
  signal: AbortSignal;
  onProgress: (progress: number) => void;
}) => {
  signal.throwIfAborted();
  const prepared: ScreenshotSavePayload['screenshots'] = [];
  for (const shot of screenshots) {
    signal.throwIfAborted();
    const annotations: CaptureAnnotations = (await annotationsStorage.getAnnotations(shot.id!)) ?? { objects: [] };
    let preview = shot.id === activeId && renderActive ? renderActive() : shot.src;
    if (!(shot.id === activeId && renderActive) && annotations.objects.length && annotations.meta) {
      const { width, height } = annotations.meta.sizes.natural;
      preview = await blobDataUrl(
        await mergeScreenshot({
          screenshot: shot,
          objects: annotations.objects as FabricObject[],
          parentWidth: width,
          parentHeight: height,
        }),
      );
    }
    prepared.push({
      id: shot.id!,
      original: shot.src,
      preview,
      thumbnail: await thumbnailFor(preview),
      annotations,
      isPrimary: shot.isPrimary === true,
    });
  }
  const serialized = JSON.stringify({
    id: context.captureId,
    snapshotId: context.id,
    expectedRevision: revision,
    title,
    screenshots: prepared,
  } satisfies ScreenshotSavePayload);
  signal.throwIfAborted();
  const uploadId = await sendLibrary<string>({ type: 'LIBRARY:BEGIN', snapshotId: context.id });
  try {
    for (let start = 0, index = 0; start < serialized.length; start += CHUNK_SIZE, index += 1) {
      signal.throwIfAborted();
      await sendLibrary({ type: 'LIBRARY:CHUNK', uploadId, index, text: serialized.slice(start, start + CHUNK_SIZE) });
      onProgress(Math.min(95, Math.round(((start + CHUNK_SIZE) / serialized.length) * 95)));
    }
    signal.throwIfAborted();
    const savedRevision = await sendLibrary<number>({ type: 'LIBRARY:COMMIT', uploadId });
    onProgress(100);
    return savedRevision;
  } catch (cause) {
    await sendLibrary({ type: 'LIBRARY:ABORT', uploadId }).catch(() => undefined);
    throw cause;
  }
};

export { captureLibraryContext, saveScreenshotsToLibrary, prepareLibrarySession, createLibrarySaveSession };
export type { LibraryContext, LibrarySaveSession };
