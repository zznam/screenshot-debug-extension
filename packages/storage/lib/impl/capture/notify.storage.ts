import { createStorage } from '../../base/base.js';
import { StorageEnum } from '../../base/enums.js';
import type { BaseStorage } from '../../base/types.js';

type CaptureNotifyStorage = { notified: boolean };

const defaultNotifyState: CaptureNotifyStorage = { notified: false };

const storage = createStorage<CaptureNotifyStorage>('capture-notify-storage-key', defaultNotifyState, {
  storageEnum: StorageEnum.Local,
  liveUpdate: true,
});

type ExtendedCaptureNotifyStorage = BaseStorage<CaptureNotifyStorage> & {
  setNotified: (notified: boolean) => Promise<void>;
  reset: () => Promise<void>;
};

const captureNotifyStorage: ExtendedCaptureNotifyStorage = {
  ...storage,
  setNotified: async (notified: boolean) => {
    await storage.set({ notified });
  },
  reset: async () => {
    await storage.set(defaultNotifyState);
  },
};

export { captureNotifyStorage, defaultNotifyState };
export type { CaptureNotifyStorage, ExtendedCaptureNotifyStorage };
