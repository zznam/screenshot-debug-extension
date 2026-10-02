import { SessionAccessLevelEnum, StorageEnum } from './enums.js';
import type { BaseStorage, StorageConfig, ValueOrUpdate } from './types.js';

/**
 * Chrome reference error while running `processTailwindFeatures` in tailwindcss.
 *  To avoid this, we need to check if the globalThis.chrome is available and add fallback logic.
 */
const chrome = globalThis.chrome;

/**
 * If one session storage needs access from content scripts, we need to enable it globally.
 * @default false
 */
let globalSessionAccessLevelFlag: StorageConfig['sessionAccessForContentScripts'] = false;

/**
 * Checks if the storage permission is granted in the manifest.json.
 */
const checkStoragePermission = (storageEnum: StorageEnum): void => {
  if (!chrome) {
    return;
  }

  if (chrome.storage[storageEnum] === undefined) {
    throw new Error(`Check your storage permission in manifest.json: ${storageEnum} is not defined`);
  }
};

/**
 * Creates a storage area for persisting and exchanging data.
 */
export const createStorage = <D = string>(key: string, fallback: D, config?: StorageConfig<D>): BaseStorage<D> => {
  let cache: D | null = null;
  let revision = 0;
  let pendingWrite: Promise<void> = Promise.resolve();
  let listeners: Array<() => void> = [];

  const storageEnum = config?.storageEnum ?? StorageEnum.Local;
  const liveUpdate = config?.liveUpdate ?? false;

  const serialize = config?.serialization?.serialize ?? ((v: D) => v);
  const deserialize = (value: unknown): D => {
    if (value === undefined) {
      return fallback;
    }
    if (config?.serialization?.deserialize) {
      return typeof value === 'string'
        ? config.serialization.deserialize(value)
        : config.serialization.deserialize(JSON.stringify(value));
    }
    return value as D;
  };

  // Set global session storage access level for StoryType.Session, only when not already done but needed.
  if (
    globalSessionAccessLevelFlag === false &&
    storageEnum === StorageEnum.Session &&
    config?.sessionAccessForContentScripts === true
  ) {
    checkStoragePermission(storageEnum);
    chrome?.storage[storageEnum]
      .setAccessLevel({
        accessLevel: SessionAccessLevelEnum.ExtensionPagesAndContentScripts,
      })
      .catch(error => {
        console.warn(error);
        console.warn('Please call setAccessLevel into different context, like a background script.');
      });
    globalSessionAccessLevelFlag = true;
  }

  // Register life cycle methods
  const get = async (): Promise<D> => {
    checkStoragePermission(storageEnum);
    const value = await chrome?.storage[storageEnum].get([key]);

    if (!value || value[key] === undefined) {
      return fallback;
    }

    return deserialize(value[key]);
  };

  const _emitChange = () => {
    listeners.forEach(listener => listener());
  };

  const set = (valueOrUpdate: ValueOrUpdate<D>): Promise<void> => {
    const write = pendingWrite.then(async () => {
      // Read the persisted value for each queued update, including changes from
      // other extension contexts. Chrome storage does not offer cross-context CAS.
      const current = await get();
      const next =
        typeof valueOrUpdate === 'function'
          ? await (valueOrUpdate as (previous: D) => D | Promise<D>)(current)
          : valueOrUpdate;
      await chrome?.storage[storageEnum].set({ [key]: serialize(next) });
      cache = next;
      revision += 1;
      _emitChange();
    });
    // A failed write rejects its caller without poisoning subsequent updates.
    pendingWrite = write.catch(() => undefined);
    return write;
  };

  const subscribe = (listener: () => void) => {
    listeners = [...listeners, listener];

    return () => {
      listeners = listeners.filter(l => l !== listener);
    };
  };

  const getSnapshot = () => {
    return cache;
  };

  const initialRevision = revision;
  get()
    .then(data => {
      // An onChanged event or completed write can arrive before this initial read.
      if (revision !== initialRevision) return;
      cache = data;
      _emitChange();
    })
    .catch(error => {
      if (revision === initialRevision) {
        cache = fallback;
        _emitChange();
      }
      console.warn('Could not initialize extension storage:', error);
    });

  const _updateFromStorageOnChanged = (changes: { [key: string]: chrome.storage.StorageChange }) => {
    if (changes[key] === undefined) return;
    revision += 1;
    const next = deserialize(changes[key].newValue);
    if (cache === next) return;
    cache = next;
    _emitChange();
  };

  // Register listener for live updates for our storage area
  if (liveUpdate) {
    chrome?.storage[storageEnum].onChanged.addListener(_updateFromStorageOnChanged);
  }

  return {
    get,
    set,
    getSnapshot,
    subscribe,
  };
};
