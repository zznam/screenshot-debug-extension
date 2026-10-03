import { createSendMessageToTab, getCapturePageError, CAPTURE } from '@extension/shared';
import { captureStateStorage, captureTabStorage, captureStartErrorStorage } from '@extension/storage';

import type { CaptureType } from '../types';

type CaptureApi = Pick<typeof chrome, 'tabs'>;
type CaptureStores = {
  state: Pick<typeof captureStateStorage, 'get' | 'setScreenshotState'>;
  tab: Pick<typeof captureTabStorage, 'setCaptureTabId'>;
};
type SendCapture = (tabId: number, message: Record<string, unknown>) => Promise<{ ok?: boolean; error?: string }>;

const createStartScreenshotCapture = (api: CaptureApi, stores: CaptureStores, send: SendCapture) => {
  let starting = false;
  return async (tabId: number, type: CaptureType): Promise<void> => {
    if (starting) throw new Error('A capture is already starting. Please wait.');
    starting = true;
    let claimedSession = false;
    try {
      if (!['area', 'viewport', 'full-page'].includes(type)) throw new Error('Unknown screenshot capture mode.');
      const tab = await api.tabs.get(tabId);
      const unavailable = getCapturePageError(tab.url);
      if (unavailable) throw new Error(unavailable);
      const current = await stores.state.get();
      if (!['idle', 'error'].includes(current.state))
        throw new Error('Finish or discard the current capture before starting another.');
      claimedSession = true;
      await stores.tab.setCaptureTabId(tabId);
      await stores.state.setScreenshotState('capturing');
      const response = await send(tabId, { action: 'START_SCREENSHOT', payload: { type } });
      if (!response?.ok)
        throw new Error(response?.error || 'Capture tools did not acknowledge the screenshot request.');
    } catch (cause) {
      if (claimedSession) {
        await Promise.allSettled([
          stores.state.setScreenshotState('idle'),
          stores.tab.setCaptureTabId(null),
          api.tabs.sendMessage(tabId, { action: CAPTURE.EXIT }),
        ]);
      }
      throw cause;
    } finally {
      starting = false;
    }
  };
};

const start = createStartScreenshotCapture(
  chrome,
  { state: captureStateStorage, tab: captureTabStorage },
  createSendMessageToTab(chrome),
);
const startScreenshotFromTab = async (tabId: number, type: CaptureType): Promise<void> => {
  await captureStartErrorStorage.set(null);
  try {
    await start(tabId, type);
    await chrome.action.setTitle({ title: 'Screenshot & Debug' });
  } catch (cause) {
    await captureStartErrorStorage.set(cause instanceof Error ? cause.message : 'Could not start capture.');
    throw cause;
  }
};

const captureTypeForCommand = (command: string): CaptureType | null => {
  switch (command) {
    case 'capture-area':
      return 'area';
    case 'capture-viewport':
      return 'viewport';
    case 'capture-full-page':
      return 'full-page';
    default:
      return null;
  }
};

const handleOnCaptureCommand = async (command: string, tab?: chrome.tabs.Tab): Promise<void> => {
  const type = captureTypeForCommand(command);
  if (!type) return;
  try {
    const activeTab = tab ?? (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
    if (typeof activeTab?.id !== 'number') throw new Error('Could not find the active page.');
    await startScreenshotFromTab(activeTab.id, type);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Could not start capture.';
    await captureStartErrorStorage.set(message);
    await chrome.action.setTitle({ title: `Screenshot & Debug: ${message}` });
  }
};

export { createStartScreenshotCapture, startScreenshotFromTab, captureTypeForCommand, handleOnCaptureCommand };
