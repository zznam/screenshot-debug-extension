import type { Tabs } from 'webextension-polyfill';

import { annotationsRedoStorage, annotationsStorage, captureStateStorage, captureTabStorage } from '@extension/storage';

import { deleteRecords } from '@src/utils';

import { detachAiDebugSessionsFromTab } from './ai-debug-indexed-db.service';

export const handleOnTabRemoved = async (tabId: number) => {
  try {
    await deleteRecords(tabId);
    await detachAiDebugSessionsFromTab(tabId);
    console.log('handleOnTabRemoved: records deleted ');

    const captureTabId = await captureTabStorage.getCaptureTabId();
    if (tabId === captureTabId) {
      await Promise.all([
        captureStateStorage.setCaptureState('idle'),
        captureTabStorage.setCaptureTabId(null),
        annotationsStorage.clearAll(),
        annotationsRedoStorage.clearAll(),
      ]);
    }
  } catch (e) {
    console.error('[background] onTabRemoved error:', e);
  }
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const handleOnTabUpdated = async (tabId: number, changeInfo: Tabs.OnUpdatedChangeInfoType, tab: Tabs.Tab) => {
  try {
    if (changeInfo.status !== 'loading') return;

    const [state, capturedTabId] = await Promise.all([
      captureStateStorage.getCaptureState(),
      captureTabStorage.getCaptureTabId(),
    ]);

    if (!capturedTabId && state === 'unsaved') {
      await captureStateStorage.setCaptureState('idle');
    }

    if (tabId === capturedTabId) {
      await Promise.all([
        captureStateStorage.setCaptureState('idle'),
        captureTabStorage.setCaptureTabId(null),
        annotationsStorage.clearAll(),
        annotationsRedoStorage.clearAll(),
      ]);
    }
  } catch (err) {
    console.error('[background] onTabUpdated error:', err);
  }
};
