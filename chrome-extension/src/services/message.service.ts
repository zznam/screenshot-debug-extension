import { strToU8, zipSync } from 'fflate';
import type { Runtime } from 'webextension-polyfill';
import { tabs } from 'webextension-polyfill';

import {
  annotationsRedoStorage,
  annotationsStorage,
  captureStateStorage,
  captureTabStorage,
  captureSettingsStorage,
} from '@extension/storage';

import type { BgResponse } from '@src/types';
import { addOrMergeRecords, deleteRecords, getRecords } from '@src/utils';

import { handleOnAuthStart } from './auth.service';
import { buildHarLog } from '../utils/har-builder.util';
import { buildDebugReport } from '../utils/report-builder.util';

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
        if (typeof tabId === 'number') addOrMergeRecords(tabId, message.data as any);

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
          await chrome.downloads.download({
            url: screenshot.src,
            filename: filename,
            saveAs: false,
          });
        }

        if (saveDebugLog) {
          const tabId = sender.tab?.id;
          let records = tabId ? await getRecords(tabId) : [];
          const settings = await captureSettingsStorage.get();

          if (!settings.includePerformance) {
            records = records.filter((r: any) => r.recordType !== 'performance');
          }
          const report = buildDebugReport(records, {
            ...payload,
            screenshots: screenshots.map((s: any) => ({
              type: s.isPrimary ? 'cropped' : 'full-page',
              filename: `${name}${s.isPrimary ? '' : '-full'}.png`,
            })),
          });

          const jsonString = JSON.stringify(report, null, 2);
          const base64Data = btoa(unescape(encodeURIComponent(jsonString)));
          const jsonUrl = `data:application/json;base64,${base64Data}`;

          await chrome.downloads.download({
            url: jsonUrl,
            filename: `${name}.json`,
            saveAs: false,
          });
        }

        return { status: 'success' };
      }

      case 'DOWNLOAD_ZIP': {
        const payload = message.payload as any;
        const { screenshots, name, saveDebugLog = true } = payload;

        const zipData: Record<string, Uint8Array> = {};

        for (const screenshot of screenshots) {
          const filename = `${name}${screenshot.isPrimary ? '' : '-full'}.png`;
          try {
            const res = await fetch(screenshot.src);
            const arrayBuffer = await res.arrayBuffer();
            zipData[filename] = new Uint8Array(arrayBuffer);
          } catch (e) {
            console.error('[background] Failed to convert screenshot for zip:', e);
          }
        }

        if (saveDebugLog) {
          const tabId = sender.tab?.id;
          let records = tabId ? await getRecords(tabId) : [];
          const settings = await captureSettingsStorage.get();

          if (!settings.includePerformance) {
            records = records.filter((r: any) => r.recordType !== 'performance');
          }

          const report = buildDebugReport(records, {
            ...payload,
            screenshots: screenshots.map((s: any) => ({
              type: s.isPrimary ? 'cropped' : 'full-page',
              filename: `${name}${s.isPrimary ? '' : '-full'}.png`,
            })),
          });

          const jsonString = JSON.stringify(report, null, 2);
          zipData[`${name}.json`] = strToU8(jsonString);

          const harLog = buildHarLog(records, payload.url || 'unknown');
          zipData[`network.har`] = strToU8(JSON.stringify(harLog, null, 2));
        }

        const zipped = zipSync(zipData);
        const blob = new Blob([zipped], { type: 'application/zip' });
        const reader = new FileReader();

        reader.onloadend = async () => {
          const base64Url = reader.result as string;
          await chrome.downloads.download({
            url: base64Url,
            filename: `${name}.zip`,
            saveAs: false,
          });
        };
        reader.readAsDataURL(blob);

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
