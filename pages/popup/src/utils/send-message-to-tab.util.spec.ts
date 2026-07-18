import { describe, expect, it, vi } from 'vitest';

import { CONTENT_SCRIPT } from '@extension/shared';

import { createSendMessageToTab } from './send-message-to-tab.util';

vi.mock('@extension/shared', () => ({
  CONTENT_SCRIPT: { PING: 'CONTENT_SCRIPT:PING' },
}));

const missingReceiver = new Error('Could not establish connection. Receiving end does not exist.');

const createApi = () => {
  const api = {
    tabs: {
      get: vi.fn().mockResolvedValue({ id: 7, url: 'https://example.test/' }),
      sendMessage: vi.fn(),
    },
    scripting: {
      executeScript: vi.fn().mockResolvedValue([]),
      insertCSS: vi.fn().mockResolvedValue(undefined),
    },
  };

  return api;
};

describe('sendMessageToTab', () => {
  it('returns the first response without injecting', async () => {
    const api = createApi();
    api.tabs.sendMessage.mockResolvedValueOnce({ ok: true });

    const sendMessage = createSendMessageToTab(api as never);

    await expect(sendMessage(7, { action: 'START_SCREENSHOT' })).resolves.toEqual({ ok: true });
    expect(api.scripting.executeScript).not.toHaveBeenCalled();
  });

  it('injects, verifies readiness, and retries a missing receiver once', async () => {
    const api = createApi();
    api.tabs.sendMessage
      .mockRejectedValueOnce(missingReceiver)
      .mockResolvedValueOnce({ ok: true, ready: true })
      .mockResolvedValueOnce({ ok: true });

    const sendMessage = createSendMessageToTab(api as never);

    await expect(sendMessage(7, { action: 'START_SCREENSHOT' })).resolves.toEqual({ ok: true });
    expect(api.scripting.executeScript).toHaveBeenCalledTimes(3);
    expect(api.scripting.insertCSS).toHaveBeenCalledOnce();
    expect(api.tabs.sendMessage).toHaveBeenNthCalledWith(2, 7, { action: CONTENT_SCRIPT.PING });
    expect(api.tabs.sendMessage).toHaveBeenCalledTimes(3);
  });

  it('rejects restricted pages before injection', async () => {
    const api = createApi();
    api.tabs.sendMessage.mockRejectedValueOnce(missingReceiver);
    api.tabs.get.mockResolvedValueOnce({ id: 7, url: 'chrome://extensions/' });

    const sendMessage = createSendMessageToTab(api as never);

    await expect(sendMessage(7, { action: 'START_SCREENSHOT' })).rejects.toThrow(
      'Open a regular HTTP or HTTPS website',
    );
    expect(api.scripting.executeScript).not.toHaveBeenCalled();
  });

  it('normalizes injection failures', async () => {
    const api = createApi();
    api.tabs.sendMessage.mockRejectedValueOnce(missingReceiver);
    api.scripting.executeScript.mockRejectedValueOnce(new Error('Cannot access contents of the page'));

    const sendMessage = createSendMessageToTab(api as never);

    await expect(sendMessage(7, { action: 'START_SCREENSHOT' })).rejects.toThrow('could not initialize capture tools');
  });

  it('fails when the injected listener does not acknowledge readiness', async () => {
    const api = createApi();
    api.tabs.sendMessage.mockRejectedValueOnce(missingReceiver).mockResolvedValueOnce({ ok: false });

    const sendMessage = createSendMessageToTab(api as never);

    await expect(sendMessage(7, { action: 'START_SCREENSHOT' })).rejects.toThrow(
      'Capture tools were loaded but did not start',
    );
  });

  it('does not retry more than once', async () => {
    const api = createApi();
    api.tabs.sendMessage
      .mockRejectedValueOnce(missingReceiver)
      .mockResolvedValueOnce({ ok: true, ready: true })
      .mockRejectedValueOnce(missingReceiver);

    const sendMessage = createSendMessageToTab(api as never);

    await expect(sendMessage(7, { action: 'START_SCREENSHOT' })).rejects.toThrow(
      'Capture tools were loaded but did not start',
    );
    expect(api.tabs.sendMessage).toHaveBeenCalledTimes(3);
  });

  it('normalizes non-recoverable connection errors', async () => {
    const api = createApi();
    api.tabs.sendMessage.mockRejectedValueOnce(new Error('The message port closed'));

    const sendMessage = createSendMessageToTab(api as never);

    await expect(sendMessage(7, { action: 'START_SCREENSHOT' })).rejects.toThrow('could not connect to this page');
  });
});
