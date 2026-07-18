import { CONTENT_SCRIPT } from '@extension/shared';

type RecoveryChromeApi = {
  tabs: {
    get: (tabId: number) => Promise<chrome.tabs.Tab>;
    sendMessage: <Response>(tabId: number, message: unknown) => Promise<Response>;
  };
  scripting: {
    executeScript: typeof chrome.scripting.executeScript;
    insertCSS: typeof chrome.scripting.insertCSS;
  };
};

type ReadyResponse = { ok?: boolean; ready?: boolean };

const isMissingReceiverError = (error: unknown) => {
  const message = (error as Error)?.message ?? String(error);
  return message.includes('Receiving end does not exist') || message.includes('Could not establish connection');
};

const captureConnectionError = (stage: 'connect' | 'inject' | 'start') => {
  const messages = {
    connect: 'Screenshot & Debug could not connect to this page. Reload the page and try again.',
    inject: 'Screenshot & Debug could not initialize capture tools on this page. Reload the extension and try again.',
    start: 'Capture tools were loaded but did not start. Reload the page and try again.',
  } as const;

  return new Error(messages[stage]);
};

const assertInjectableTab = (tab: chrome.tabs.Tab) => {
  if (!tab.url || !/^https?:/.test(tab.url)) {
    throw new Error('Open a regular HTTP or HTTPS website before starting a capture.');
  }
};

export const createSendMessageToTab = (api: RecoveryChromeApi) =>
  async function sendMessageToTab<Response>(tabId: number, message: Record<string, unknown>): Promise<Response> {
    try {
      return await api.tabs.sendMessage<Response>(tabId, message);
    } catch (error) {
      if (!isMissingReceiverError(error)) throw captureConnectionError('connect');
    }

    const tab = await api.tabs.get(tabId);
    assertInjectableTab(tab);

    try {
      await api.scripting.executeScript({
        target: { tabId },
        func: () => document.getElementById('brie-root')?.remove(),
      });
      await api.scripting.executeScript({ target: { tabId }, files: ['content/index.iife.js'] });
      await api.scripting.executeScript({ target: { tabId }, files: ['content-ui/index.iife.js'] });
      await api.scripting.insertCSS({ target: { tabId }, files: ['content.css'] });
    } catch (error) {
      console.error('[Screenshot & Debug] Content-script injection failed:', error);
      throw captureConnectionError('inject');
    }

    try {
      const ready = await api.tabs.sendMessage<ReadyResponse>(tabId, { action: CONTENT_SCRIPT.PING });
      if (!ready?.ok || !ready.ready) throw new Error('Capture listener did not acknowledge readiness.');
    } catch (error) {
      console.error('[Screenshot & Debug] Content-script readiness check failed:', error);
      throw captureConnectionError('start');
    }

    try {
      return await api.tabs.sendMessage<Response>(tabId, message);
    } catch (error) {
      console.error('[Screenshot & Debug] Capture retry failed:', error);
      throw captureConnectionError('start');
    }
  };

export const sendMessageToTab = <Response>(tabId: number, message: Record<string, unknown>) =>
  createSendMessageToTab(chrome)<Response>(tabId, message);
