import type { Runtime } from 'webextension-polyfill';
import { tabs } from 'webextension-polyfill';

import { AI_DEBUG, REWIND, TAB } from '@extension/shared';
import {
  annotationsRedoStorage,
  annotationsStorage,
  captureSettingsStorage,
  captureStateStorage,
  captureTabStorage,
} from '@extension/storage';

import { getAiDebug, listAiDebug, removeAiDebug, saveAiDebugMessage, startAiDebug } from './ai-debug.service';
import { handleOnAuthStart } from './auth.service';
import { handleLibraryMessage } from './capture-library.service';
import { startScreenshotFromTab } from './capture-start.service';
import { downloadAssets, downloadZip } from './download.service';
import type { BgResponse } from '../types';
import { addOrMergeRecords, deleteRecords, getRecords, rewindService } from '../utils';

export const handleOnMessage = async (raw: unknown, sender: Runtime.MessageSender): Promise<BgResponse | void> => {
  const message = raw as Record<string, unknown>;

  try {
    if (typeof message.type === 'string' && message.type.startsWith('LIBRARY:')) {
      return handleLibraryMessage(message, sender);
    }
    switch (message.type) {
      case 'OPEN_CAPTURE_LIBRARY': {
        await tabs.create({ url: chrome.runtime.getURL('library/index.html') });
        return { status: 'success' };
      }
      case 'START_SCREENSHOT_CAPTURE': {
        if (typeof message.tabId !== 'number') return { ok: false, error: 'Could not find the capture page.' };
        try {
          await startScreenshotFromTab(
            message.tabId,
            message.captureType as Parameters<typeof startScreenshotFromTab>[1],
          );
          return { ok: true };
        } catch (cause) {
          return { ok: false, error: cause instanceof Error ? cause.message : 'Could not start capture.' };
        }
      }

      case AI_DEBUG.START:
        return startAiDebug(message.tabId as number);

      case AI_DEBUG.START_ANNOTATED: {
        const tabId = sender.tab?.id;
        const screenshotDataUrl = message.screenshotDataUrl;
        if (typeof tabId !== 'number') {
          return { status: 'error', code: 'TAB_NOT_FOUND', message: 'The annotated source tab is no longer open.' };
        }
        if (typeof screenshotDataUrl !== 'string' || !/^data:image\/(?:png|jpe?g);base64,/.test(screenshotDataUrl)) {
          return {
            status: 'error',
            code: 'INVALID_SCREENSHOT',
            message: 'The annotated screenshot could not be read.',
          };
        }
        return startAiDebug(tabId, screenshotDataUrl);
      }

      case AI_DEBUG.GET_CONTEXT:
      case AI_DEBUG.GET_SESSION:
        return getAiDebug(message.sessionId as string);

      case AI_DEBUG.LIST_SESSIONS:
        return listAiDebug();

      case AI_DEBUG.SAVE_MESSAGE:
        return saveAiDebugMessage(
          message.sessionId as string,
          message.message as Parameters<typeof saveAiDebugMessage>[1],
          message.model as string | undefined,
        );

      case AI_DEBUG.DELETE_SESSION:
        return removeAiDebug(message.sessionId as string);

      case 'EXIT_CAPTURE': {
        await Promise.all([
          captureStateStorage.setCaptureState('idle'),
          captureTabStorage.setCaptureTabId(null),
          annotationsStorage.clearAll(),
          annotationsRedoStorage.clearAll(),
        ]);

        return { status: 'success' };
      }

      case 'ADD_RECORD': {
        const tabId = sender.tab?.id;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (typeof tabId === 'number') addOrMergeRecords(tabId, message.data as any);

        return { status: 'success' };
      }

      case 'GET_RECORDS': {
        const tabId = typeof message.tabId === 'number' ? message.tabId : sender.tab?.id;
        const records = tabId ? await getRecords(tabId) : [];

        return { records };
      }

      case 'DELETE_RECORDS': {
        const tabId = sender.tab?.id;
        if (typeof tabId === 'number') await deleteRecords(tabId);

        return { status: 'success' };
      }

      case 'AUTH_START':
        return handleOnAuthStart();

      case TAB.GET_ACTIVE: {
        const [tab] = await tabs.query({ active: true, currentWindow: true });
        return { tab: tab ?? {} } as BgResponse;
      }

      case REWIND.EVENT_BATCH: {
        const events = Array.isArray(message.events) ? (message.events as unknown[]) : [];

        await rewindService.ingestBatch(events, sender);
        return { status: 'success' };
      }

      case REWIND.FREEZE: {
        const tabId = (message?.tabId as number | undefined) ?? sender.tab?.id;

        if (typeof tabId !== 'number') return { status: 'error', message: 'Invalid tabId' };

        const frozen = await rewindService.freeze(tabId);

        const durationMs = frozen.toTimestamp - frozen.fromTimestamp;
        const eventCount = frozen.events?.length ?? 0;

        addOrMergeRecords(tabId, {
          type: 'event',
          recordType: 'events',
          source: 'background',
          event: 'SessionReplayCaptured',
          timestamp: Date.now(),
          url: (await tabs.get(tabId).catch(() => null))?.url ?? '',
          description: `Session replay captured (${Math.round(durationMs / 1000)}s, ${eventCount} events)`,
          extra: {
            action: 'CAPTURED',
            durationMs,
            eventCount,
            fromTimestamp: frozen.fromTimestamp,
            toTimestamp: frozen.toTimestamp,
            missingAnchor: frozen.missingAnchor,
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);

        return { status: 'success', ...frozen };
      }

      case REWIND.GET_FROZEN: {
        const tabId = (message?.tabId as number | undefined) ?? sender.tab?.id;

        if (!tabId) return { status: 'error', message: 'Invalid tabId' };

        return (await rewindService.getFrozenOrFreeze(tabId)) as unknown as BgResponse;
      }

      case REWIND.RESET_TAB: {
        const tabId = message?.tabId as number | undefined;

        if (typeof tabId !== 'number') return { status: 'error', message: 'Invalid tabId' };

        await rewindService.resetTab(tabId);
        return { status: 'success' };
      }

      case REWIND.DELETE_TAB: {
        const tabId = (message?.tabId as number | undefined) ?? sender.tab?.id;

        if (!tabId) return { status: 'error', message: 'Invalid tabId' };

        await rewindService.deleteTab(tabId);
        return { status: 'success' };
      }

      case REWIND.BLOCKED:
        return { status: 'success' };

      case 'DOWNLOAD_ASSETS': {
        return downloadAssets(message.payload as unknown as DownloadPayload, sender.tab?.id);
      }

      case 'DOWNLOAD_ZIP': {
        return downloadZip(message.payload as unknown as DownloadPayload, sender.tab?.id);
      }
    }

    if ('action' in message) {
      if (message.action === 'checkNativeCapture') {
        const isAvailable = typeof tabs?.captureVisibleTab === 'function';

        return { isAvailable };
      }

      if (message.action === 'captureVisibleTab') {
        try {
          const settings = await captureSettingsStorage.get();
          const options: chrome.extensionTypes.ImageDetails =
            settings.screenshotFormat === 'jpeg'
              ? { format: 'jpeg', quality: settings.screenshotQuality }
              : { format: 'png' };

          const windowId = sender.tab?.windowId;
          const dataUrl = await tabs.captureVisibleTab(windowId, options);

          return { success: true, dataUrl };
        } catch (e) {
          const msg = (e as Error)?.message ?? String(e);
          return { success: false, message: msg };
        }
      }
    }
  } catch (e) {
    console.error('[background] onMessage error:', e);
    return { status: 'error', message: (e as Error)?.message ?? String(e) };
  }
};
