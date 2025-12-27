import type { Runtime } from 'webextension-polyfill';
import { tabs } from 'webextension-polyfill';

import { annotationsRedoStorage, annotationsStorage, captureStateStorage, captureTabStorage } from '@extension/storage';

import type { BgResponse } from '@src/types';
import { addOrMergeRecords, deleteRecords, getRecords } from '@src/utils';

import { handleOnAuthStart } from './auth.service';

export const handleOnMessage = async (raw: unknown, sender: Runtime.MessageSender): Promise<BgResponse | void> => {
  const message = raw as Record<string, unknown>;

  try {
    switch (message.type) {
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
        if (typeof tabId === 'number') addOrMergeRecords(tabId, message.data);

        return { status: 'success' };
      }

      case 'GET_RECORDS': {
        const tabId = sender.tab?.id;
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

      case 'DOWNLOAD_ASSETS': {
        const payload = message.payload as any;
        const { screenshots, name, saveDebugLog = true } = payload;

        // Download screenshots
        for (const screenshot of screenshots) {
          const filename = `${name}${screenshot.isPrimary ? '' : '-full'}.png`;
          // Use chrome.downloads directly as it is not in webextension-polyfill types usually or just to be safe
          await chrome.downloads.download({
            url: screenshot.src,
            filename: filename,
            saveAs: false,
          });
        }

        // Only download JSON log if debug mode is enabled
        if (saveDebugLog) {
          // Fetch captured records (network, console, etc.)
          const tabId = sender.tab?.id;
          const records = tabId ? await getRecords(tabId) : [];

          // Download JSON log
          const logData = {
            ...payload,
            logs: records,
            screenshots: screenshots.map((s: any) => ({
              ...s,
              src: '[Content Redacted]', // Don't save the huge data URL in JSON
              filename: `${name}${s.isPrimary ? '' : '-full'}.png`,
            })),
          };

          const jsonString = JSON.stringify(logData, null, 2);
          const base64Data = btoa(unescape(encodeURIComponent(jsonString))); // specific encoding for unicode
          const jsonUrl = `data:application/json;base64,${base64Data}`;

          await chrome.downloads.download({
            url: jsonUrl,
            filename: `${name}.json`,
            saveAs: false,
          });
        }

        return { status: 'success' };
      }
    }

    if ('action' in message) {
      if (message.action === 'checkNativeCapture') {
        const isAvailable = typeof tabs?.captureVisibleTab === 'function';

        return { isAvailable };
      }

      if (message.action === 'captureVisibleTab') {
        try {
          const dataUrl = await tabs.captureVisibleTab(undefined, {
            format: 'jpeg',
            quality: 100,
          });

          return { success: true, dataUrl };
        } catch (e) {
          const msg = (e as Error)?.message ?? String(e);
          return { success: false, message: msg };
        }
      }
    }
  } catch (e) {
    console.error('[background] onMessage error:', e);
  }
};
