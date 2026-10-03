import { createStorage } from '../../base/base.js';
import { StorageEnum } from '../../base/enums.js';

export const captureStartErrorStorage = createStorage<string | null>('capture-start-error', null, {
  storageEnum: StorageEnum.Session,
  liveUpdate: true,
});
