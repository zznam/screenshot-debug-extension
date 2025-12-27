import { createStorage } from '../../base/base.js';
import { StorageEnum } from '../../base/enums.js';
import type { BaseStorage } from '../../base/types.js';

type DebugModeStorage = BaseStorage<boolean> & {
  setDebugMode: (enabled: boolean) => Promise<void>;
  getDebugMode: () => Promise<boolean>;
  toggleDebugMode: () => Promise<boolean>;
};

const storage = createStorage<boolean>(
  'debug-mode-storage-key',
  false, // Default: debug records disabled for new sites
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

export const debugModeStorage: DebugModeStorage = {
  ...storage,

  // Set debug mode on/off
  setDebugMode: async (enabled: boolean) => {
    await storage.set(enabled);
  },

  // Get current debug mode state
  getDebugMode: async () => {
    return await storage.get();
  },

  // Toggle debug mode and return new state
  toggleDebugMode: async () => {
    const current = await storage.get();
    const newValue = !current;
    await storage.set(newValue);
    return newValue;
  },
};
