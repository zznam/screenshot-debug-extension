import { beforeEach, describe, expect, it, vi } from 'vitest';

import { captureSettingsStorage } from '@extension/storage';

import { handleOnMessage } from './message.service';

vi.mock('webextension-polyfill', () => ({
  tabs: {
    captureVisibleTab: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('../utils', () => ({
  addOrMergeRecords: vi.fn(),
  deleteRecords: vi.fn(),
  getRecords: vi.fn(),
  rewindService: vi.fn(),
}));

vi.mock('./ai-debug.service', () => ({
  getAiDebug: vi.fn(),
  listAiDebug: vi.fn(),
  removeAiDebug: vi.fn(),
  saveAiDebugMessage: vi.fn(),
  startAiDebug: vi.fn(),
}));

vi.mock('./auth.service', () => ({
  handleOnAuthStart: vi.fn(),
}));

vi.mock('./capture-library.service', () => ({
  handleLibraryMessage: vi.fn(),
}));

vi.mock('./capture-start.service', () => ({
  startScreenshotFromTab: vi.fn(),
}));

vi.mock('./download.service', () => ({
  downloadAssets: vi.fn(),
  downloadZip: vi.fn(),
}));

vi.mock('@extension/storage', async importOriginal => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    captureSettingsStorage: {
      get: vi.fn(),
    },
    captureStateStorage: {
      setCaptureState: vi.fn(),
    },
    captureTabStorage: {
      setCaptureTabId: vi.fn(),
    },
    annotationsStorage: {
      clearAll: vi.fn(),
    },
    annotationsRedoStorage: {
      clearAll: vi.fn(),
    },
  };
});

describe('message.service captureVisibleTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('captures tab with PNG format and sender windowId when PNG is configured', async () => {
    const { tabs } = await import('webextension-polyfill');
    vi.mocked(captureSettingsStorage.get).mockResolvedValue({
      exportFormat: 'individual',
      screenshotFormat: 'png',
      screenshotQuality: 90,
      includePerformance: false,
      retentionMinutes: 0,
      autoScreenshotOnError: false,
    });
    vi.mocked(tabs.captureVisibleTab).mockResolvedValue('data:image/png;base64,samplepng');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sender = { tab: { id: 10, windowId: 5 } } as any;
    const response = await handleOnMessage({ action: 'captureVisibleTab' }, sender);

    expect(tabs.captureVisibleTab).toHaveBeenCalledWith(5, { format: 'png' });
    expect(response).toEqual({ success: true, dataUrl: 'data:image/png;base64,samplepng' });
  });

  it('captures tab with JPEG format and quality when JPEG is configured', async () => {
    const { tabs } = await import('webextension-polyfill');
    vi.mocked(captureSettingsStorage.get).mockResolvedValue({
      exportFormat: 'individual',
      screenshotFormat: 'jpeg',
      screenshotQuality: 75,
      includePerformance: false,
      retentionMinutes: 0,
      autoScreenshotOnError: false,
    });
    vi.mocked(tabs.captureVisibleTab).mockResolvedValue('data:image/jpeg;base64,samplejpeg');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sender = { tab: { id: 12, windowId: 7 } } as any;
    const response = await handleOnMessage({ action: 'captureVisibleTab' }, sender);

    expect(tabs.captureVisibleTab).toHaveBeenCalledWith(7, { format: 'jpeg', quality: 75 });
    expect(response).toEqual({ success: true, dataUrl: 'data:image/jpeg;base64,samplejpeg' });
  });

  it('handles capture errors gracefully', async () => {
    const { tabs } = await import('webextension-polyfill');
    vi.mocked(captureSettingsStorage.get).mockResolvedValue({
      exportFormat: 'individual',
      screenshotFormat: 'png',
      screenshotQuality: 100,
      includePerformance: false,
      retentionMinutes: 0,
      autoScreenshotOnError: false,
    });
    vi.mocked(tabs.captureVisibleTab).mockRejectedValue(new Error('Cannot capture active tab'));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sender = { tab: { id: 10, windowId: 5 } } as any;
    const response = await handleOnMessage({ action: 'captureVisibleTab' }, sender);

    expect(response).toEqual({ success: false, message: 'Cannot capture active tab' });
  });
});
