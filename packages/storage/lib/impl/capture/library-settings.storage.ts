import { createStorage } from '../../base/base.js';
import { StorageEnum } from '../../base/enums.js';
import type { LibrarySaveMode } from '../../library/types.js';

const storage = createStorage<LibrarySaveMode>('library-save-mode', 'ask', {
  storageEnum: StorageEnum.Local,
  liveUpdate: true,
});

const normalize = (mode: unknown): LibrarySaveMode => (mode === 'manual' || mode === 'automatic' ? mode : 'ask');

export const librarySettingsStorage = {
  ...storage,
  get: async () => normalize(await storage.get()),
  getSnapshot: () => normalize(storage.getSnapshot()),
};
