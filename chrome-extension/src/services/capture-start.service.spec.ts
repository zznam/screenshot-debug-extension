import { beforeEach, describe, expect, it, vi } from 'vitest';

import { captureTypeForCommand, createStartScreenshotCapture } from './capture-start.service';

vi.hoisted(() => vi.stubGlobal('chrome', { tabs: {}, scripting: {} }));
vi.mock('@extension/shared', () => ({
  CAPTURE: { EXIT: 'EXIT_CAPTURE' },
  createSendMessageToTab: () => vi.fn(),
  getCapturePageError: (url: string) => (url.startsWith('https:') ? null : 'Unsupported page'),
}));
vi.mock('@extension/storage', () => ({ captureStateStorage: {}, captureTabStorage: {}, captureStartErrorStorage: {} }));

const api = { tabs: { get: vi.fn(), sendMessage: vi.fn() } };
const stores = { state: { get: vi.fn(), setScreenshotState: vi.fn() }, tab: { setCaptureTabId: vi.fn() } };
const send = vi.fn();
const factory = () => createStartScreenshotCapture(api as unknown as Pick<typeof chrome, 'tabs'>, stores, send);

beforeEach(() => {
  vi.clearAllMocks();
  api.tabs.get.mockResolvedValue({ id: 42, url: 'https://example.test' });
  api.tabs.sendMessage.mockResolvedValue({ ok: true });
  stores.state.get.mockResolvedValue({ mode: 'screenshot', state: 'idle' });
  stores.state.setScreenshotState.mockResolvedValue(undefined);
  stores.tab.setCaptureTabId.mockResolvedValue(undefined);
  send.mockResolvedValue({ ok: true });
});

describe('capture startup', () => {
  it('maps the three manifest commands without accepting unrelated commands', () => {
    expect(captureTypeForCommand('capture-area')).toBe('area');
    expect(captureTypeForCommand('capture-viewport')).toBe('viewport');
    expect(captureTypeForCommand('capture-full-page')).toBe('full-page');
    expect(captureTypeForCommand('__proto__')).toBeNull();
  });
  it('claims session ownership and requires a positive acknowledgement', async () => {
    await factory()(42, 'viewport');
    expect(stores.tab.setCaptureTabId).toHaveBeenCalledWith(42);
    expect(stores.state.setScreenshotState).toHaveBeenCalledWith('capturing');
    expect(send).toHaveBeenCalledWith(42, { action: 'START_SCREENSHOT', payload: { type: 'viewport' } });
  });
  it('does not modify an already active or unsaved session', async () => {
    stores.state.get.mockResolvedValue({ mode: 'video', state: 'paused' });
    await expect(factory()(42, 'area')).rejects.toThrow('Finish or discard');
    expect(stores.tab.setCaptureTabId).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
  it('rejects unsupported pages before changing ownership', async () => {
    api.tabs.get.mockResolvedValue({ url: 'chrome://settings' });
    await expect(factory()(42, 'area')).rejects.toThrow('Unsupported page');
    expect(stores.tab.setCaptureTabId).not.toHaveBeenCalled();
  });
  it('cleans up a negative acknowledgement and permits retry', async () => {
    send.mockResolvedValueOnce({ ok: false, error: 'Capture failed' });
    const start = factory();
    await expect(start(42, 'area')).rejects.toThrow('Capture failed');
    expect(stores.state.setScreenshotState).toHaveBeenLastCalledWith('idle');
    expect(stores.tab.setCaptureTabId).toHaveBeenLastCalledWith(null);
    expect(api.tabs.sendMessage).toHaveBeenCalledWith(42, { action: 'EXIT_CAPTURE' });
    await expect(start(42, 'viewport')).resolves.toBeUndefined();
  });
  it('rejects concurrent entry points before they can replace session ownership', async () => {
    let resolveTab!: (value: unknown) => void;
    api.tabs.get.mockReturnValueOnce(
      new Promise(resolve => {
        resolveTab = resolve;
      }),
    );
    const start = factory();
    const first = start(42, 'area');
    await expect(start(43, 'viewport')).rejects.toThrow('already starting');
    resolveTab({ url: 'https://example.test' });
    await first;
    expect(stores.tab.setCaptureTabId).toHaveBeenCalledTimes(1);
  });
  it('resets partially claimed ownership after a storage failure', async () => {
    stores.state.setScreenshotState.mockRejectedValueOnce(new Error('Storage unavailable'));
    await expect(factory()(42, 'area')).rejects.toThrow('Storage unavailable');
    expect(stores.tab.setCaptureTabId).toHaveBeenLastCalledWith(null);
    expect(send).not.toHaveBeenCalled();
  });
});
