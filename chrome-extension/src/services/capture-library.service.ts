import type { Runtime } from 'webextension-polyfill';

import { deepRedactSensitiveInfo } from '@extension/shared';
import type { LibraryResponse, ScreenshotSavePayload } from '@extension/shared';
import {
  appendLibraryChunk,
  beginLibraryUpload,
  cleanLibraryStaging,
  commitScreenshotCapture,
  discardLibraryUpload,
  getLibrarySession,
  readLibraryUpload,
  saveLibrarySession,
  captureSettingsStorage,
  debugModeStorage,
} from '@extension/storage';

import { getRecords } from '../utils/manage-records.util';

const getCaptureOwner = (sender: Runtime.MessageSender) => {
  if (
    sender.id !== chrome.runtime.id ||
    typeof sender.tab?.id !== 'number' ||
    sender.frameId !== 0 ||
    !/^https?:\/\//.test(sender.url ?? '')
  )
    throw new Error('Capture saving is only available from the source page.');
  const documentId = (sender as Runtime.MessageSender & { documentId?: string }).documentId;
  return `${sender.tab.id}:${documentId ?? sender.url}`;
};

const handleLibraryMessage = async (
  message: Record<string, unknown>,
  sender: Runtime.MessageSender,
): Promise<LibraryResponse<unknown>> => {
  try {
    const owner = getCaptureOwner(sender);
    switch (message.type) {
      case 'LIBRARY:SNAPSHOT': {
        await cleanLibraryStaging();
        const [enabled, settings] = await Promise.all([debugModeStorage.getDebugMode(), captureSettingsStorage.get()]);
        const records = enabled ? await getRecords(sender.tab!.id!) : [];
        const diagnostics = records
          .filter(record => settings.includePerformance || record.recordType !== 'performance')
          .map(record => deepRedactSensitiveInfo(record, 'https://library-export.example'));
        const sourceUrl = sender.url!;
        const session = {
          id: crypto.randomUUID(),
          captureId: crypto.randomUUID(),
          owner,
          createdAt: Date.now(),
          source: {
            url: sourceUrl,
            title: sender.tab?.title ?? '',
            domain: new URL(sourceUrl).hostname,
            capturedAt: Date.now(),
          },
          diagnostics: JSON.parse(JSON.stringify(diagnostics)) as unknown[],
        };
        await saveLibrarySession(session);
        return { status: 'success', data: { id: session.id, captureId: session.captureId, source: session.source } };
      }
      case 'LIBRARY:BEGIN':
        return { status: 'success', data: await beginLibraryUpload(String(message.snapshotId), owner) };
      case 'LIBRARY:CHUNK':
        await appendLibraryChunk(String(message.uploadId), owner, message.index as number, message.text as string);
        return { status: 'success', data: null };
      case 'LIBRARY:ABORT':
        await discardLibraryUpload(String(message.uploadId), owner);
        return { status: 'success', data: null };
      case 'LIBRARY:COMMIT': {
        const id = String(message.uploadId);
        const upload = await readLibraryUpload(id, owner);
        const session = await getLibrarySession(upload.snapshotId);
        if (!session || session.owner !== owner) throw new Error('Capture context expired.');
        const payload = JSON.parse(upload.text) as ScreenshotSavePayload;
        const revision = await commitScreenshotCapture(payload, session);
        await discardLibraryUpload(id, owner);
        return { status: 'success', data: revision };
      }
      default:
        throw new Error('Unknown library operation.');
    }
  } catch (cause) {
    const error = cause instanceof Error ? cause : new Error('Could not save this capture.');
    return {
      status: 'error',
      message:
        error.name === 'QuotaExceededError'
          ? 'Device storage is full. Download this capture or delete saved captures, then retry.'
          : error.message,
    };
  }
};

export { getCaptureOwner, handleLibraryMessage };
