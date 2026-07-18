import { describe, expect, it, vi } from 'vitest';

import { CAPTURE } from '@extension/shared';

import {
  createBeginScreenshotCapture,
  createExitScreenshotCapture,
  createReconcileScreenshotCaptureOwner,
} from './screenshot-session.util';

vi.mock('@extension/shared', () => ({
  CAPTURE: { EXIT: 'CAPTURE:EXIT' },
}));

vi.mock('@extension/storage', () => ({
  annotationsHistoryStorage: { clearAll: vi.fn() },
  annotationsRedoStorage: { clearAll: vi.fn() },
  annotationsStorage: { clearAll: vi.fn() },
  captureStateStorage: { setScreenshotState: vi.fn() },
  captureTabStorage: { setCaptureTabId: vi.fn() },
}));

const createStores = () => ({
  captureState: { setScreenshotState: vi.fn().mockResolvedValue(undefined) },
  captureTab: { setCaptureTabId: vi.fn().mockResolvedValue(undefined) },
  annotations: { clearAll: vi.fn().mockResolvedValue(undefined) },
  annotationsRedo: { clearAll: vi.fn().mockResolvedValue(undefined) },
  annotationsHistory: { clearAll: vi.fn().mockResolvedValue(undefined) },
});

const createApi = () => ({
  tabs: {
    get: vi.fn().mockResolvedValue({ id: 7, url: 'https://example.test/' }),
    sendMessage: vi.fn().mockResolvedValue({ ok: true }),
  },
});

describe('screenshot session', () => {
  it('publishes the owner before the capturing state', async () => {
    const calls: string[] = [];
    const stores = createStores();
    stores.captureTab.setCaptureTabId.mockImplementation(async () => void calls.push('owner'));
    stores.captureState.setScreenshotState.mockImplementation(async () => void calls.push('state'));

    await createBeginScreenshotCapture(stores)(7);

    expect(calls).toEqual(['owner', 'state']);
  });

  it('clears the session and closes a valid owner tab', async () => {
    const api = createApi();
    const stores = createStores();

    await createExitScreenshotCapture(api, stores)(7);

    expect(stores.captureState.setScreenshotState).toHaveBeenCalledWith('idle');
    expect(stores.captureTab.setCaptureTabId).toHaveBeenCalledWith(null);
    expect(stores.annotations.clearAll).toHaveBeenCalledOnce();
    expect(stores.annotationsRedo.clearAll).toHaveBeenCalledOnce();
    expect(stores.annotationsHistory.clearAll).toHaveBeenCalledOnce();
    expect(api.tabs.sendMessage).toHaveBeenCalledWith(7, { action: CAPTURE.EXIT });
  });

  it('clears an orphaned session without requiring an owner tab', async () => {
    const api = createApi();
    const stores = createStores();

    await createExitScreenshotCapture(api, stores)(null);

    expect(stores.captureState.setScreenshotState).toHaveBeenCalledWith('idle');
    expect(api.tabs.get).not.toHaveBeenCalled();
    expect(api.tabs.sendMessage).not.toHaveBeenCalled();
  });

  it('still clears the session when the owner tab was closed', async () => {
    const api = createApi();
    const stores = createStores();
    api.tabs.get.mockRejectedValueOnce(new Error('No tab with id: 7'));

    await expect(createExitScreenshotCapture(api, stores)(7)).resolves.toBeUndefined();
    expect(stores.captureTab.setCaptureTabId).toHaveBeenCalledWith(null);
    expect(api.tabs.sendMessage).not.toHaveBeenCalled();
  });

  it('still clears the session when the owner receiver is missing', async () => {
    const api = createApi();
    const stores = createStores();
    api.tabs.sendMessage.mockRejectedValueOnce(new Error('Receiving end does not exist'));

    await expect(createExitScreenshotCapture(api, stores)(7)).resolves.toBeUndefined();
    expect(stores.captureState.setScreenshotState).toHaveBeenCalledWith('idle');
  });

  it('attempts every cleanup and reports a normalized storage failure', async () => {
    const api = createApi();
    const stores = createStores();
    stores.annotations.clearAll.mockRejectedValueOnce(new Error('raw storage failure'));

    await expect(createExitScreenshotCapture(api, stores)(7)).rejects.toThrow(
      'some local capture data could not be cleared',
    );
    expect(stores.captureState.setScreenshotState).toHaveBeenCalledWith('idle');
    expect(stores.captureTab.setCaptureTabId).toHaveBeenCalledWith(null);
    expect(stores.annotationsHistory.clearAll).toHaveBeenCalledOnce();
    expect(api.tabs.sendMessage).toHaveBeenCalledWith(7, { action: CAPTURE.EXIT });
  });

  it('reconciles missing and closed owners to idle', async () => {
    const api = createApi();
    const exitCapture = vi.fn().mockResolvedValue(undefined);
    const reconcile = createReconcileScreenshotCaptureOwner(api, exitCapture);

    await expect(reconcile(null)).resolves.toBe(false);
    expect(exitCapture).toHaveBeenCalledWith(null);

    api.tabs.get.mockRejectedValueOnce(new Error('No tab'));
    await expect(reconcile(7)).resolves.toBe(false);
    expect(exitCapture).toHaveBeenCalledWith(7);
  });
});
