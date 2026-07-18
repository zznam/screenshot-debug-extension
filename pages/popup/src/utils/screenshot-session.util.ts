import { CAPTURE } from '@extension/shared';
import {
  annotationsHistoryStorage,
  annotationsRedoStorage,
  annotationsStorage,
  captureStateStorage,
  captureTabStorage,
} from '@extension/storage';

type ScreenshotSessionApi = {
  tabs: {
    get: (tabId: number) => Promise<chrome.tabs.Tab>;
    sendMessage: <Response>(tabId: number, message: unknown) => Promise<Response>;
  };
};

type ScreenshotSessionStores = {
  captureState: Pick<typeof captureStateStorage, 'setScreenshotState'>;
  captureTab: Pick<typeof captureTabStorage, 'setCaptureTabId'>;
  annotations: Pick<typeof annotationsStorage, 'clearAll'>;
  annotationsRedo: Pick<typeof annotationsRedoStorage, 'clearAll'>;
  annotationsHistory: Pick<typeof annotationsHistoryStorage, 'clearAll'>;
};

type ScreenshotStartStores = Pick<ScreenshotSessionStores, 'captureState' | 'captureTab'>;

const defaultStores: ScreenshotSessionStores = {
  captureState: captureStateStorage,
  captureTab: captureTabStorage,
  annotations: annotationsStorage,
  annotationsRedo: annotationsRedoStorage,
  annotationsHistory: annotationsHistoryStorage,
};

export const createExitScreenshotCapture = (api: ScreenshotSessionApi, stores: ScreenshotSessionStores) =>
  async function exitScreenshotCapture(ownerTabId: number | null): Promise<void> {
    const resetResultsPromise = Promise.allSettled([
      stores.captureState.setScreenshotState('idle'),
      stores.captureTab.setCaptureTabId(null),
      stores.annotations.clearAll(),
      stores.annotationsRedo.clearAll(),
      stores.annotationsHistory.clearAll(),
    ]);

    const closeOwnerPromise = (async () => {
      if (typeof ownerTabId !== 'number') return;

      try {
        await api.tabs.get(ownerTabId);
        await api.tabs.sendMessage(ownerTabId, { action: CAPTURE.EXIT });
      } catch {
        // The global session reset is authoritative. A closed tab or missing
        // receiver must never prevent the popup from exiting capture mode.
      }
    })();

    const [resetResults] = await Promise.all([resetResultsPromise, closeOwnerPromise]);
    const failedReset = resetResults.find(result => result.status === 'rejected');

    if (failedReset) {
      throw new Error('Screenshot capture exited, but some local capture data could not be cleared.');
    }
  };

export const createBeginScreenshotCapture = (stores: ScreenshotStartStores) =>
  async function beginScreenshotCapture(ownerTabId: number): Promise<void> {
    await stores.captureTab.setCaptureTabId(ownerTabId);
    await stores.captureState.setScreenshotState('capturing');
  };

export const createReconcileScreenshotCaptureOwner = (
  api: Pick<ScreenshotSessionApi, 'tabs'>,
  exitCapture: (ownerTabId: number | null) => Promise<void>,
) =>
  async function reconcileScreenshotCaptureOwner(ownerTabId: number | null): Promise<boolean> {
    if (typeof ownerTabId !== 'number') {
      await exitCapture(null);
      return false;
    }

    try {
      await api.tabs.get(ownerTabId);
      return true;
    } catch {
      await exitCapture(ownerTabId);
      return false;
    }
  };

export const exitScreenshotCapture = (ownerTabId: number | null) =>
  createExitScreenshotCapture(chrome, defaultStores)(ownerTabId);

export const beginScreenshotCapture = (ownerTabId: number) => createBeginScreenshotCapture(defaultStores)(ownerTabId);

export const reconcileScreenshotCaptureOwner = (ownerTabId: number | null) =>
  createReconcileScreenshotCaptureOwner(chrome, exitScreenshotCapture)(ownerTabId);
