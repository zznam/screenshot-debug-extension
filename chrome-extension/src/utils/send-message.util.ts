import { tabs } from 'webextension-polyfill';

import { ensureContentScripts } from './ensure-content-scripts.util';

const isMissingReceiverError = (error: unknown) =>
  ((error as Error)?.message ?? String(error)).includes('Receiving end does not exist');

export const sendMessageToTab = async (tabId: number, payload: unknown): Promise<void> => {
  try {
    await tabs.sendMessage(tabId, payload);
  } catch (e) {
    if (isMissingReceiverError(e)) {
      try {
        await ensureContentScripts(tabId);
        await tabs.sendMessage(tabId, payload);
        return;
      } catch (retryError) {
        console.warn('[background] content script recovery failed:', retryError);
        return;
      }
    }

    const msg = (e as Error)?.message ?? String(e);

    console.warn('[background] sendMessageToTab failed:', msg);
  }
};

export const sendMessageToActiveTab = async (action: string, payload: unknown): Promise<void> => {
  const activeTabs = await tabs.query({ active: true, currentWindow: true });
  const tabId = activeTabs[0]?.id;

  if (!tabId) return;

  await sendMessageToTab(tabId, { action, payload });
};
