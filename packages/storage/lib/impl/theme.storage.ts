import { createStorage, StorageEnum } from '../base/index.js';
import type { BaseStorage } from '../base/index.js';

type Theme = 'light' | 'dark';
type ThemePreference = Theme | 'system';

const preference = createStorage<ThemePreference>('theme-storage-key', 'system', {
  storageEnum: StorageEnum.Local,
  liveUpdate: true,
});
const systemListeners = new Set<() => void>();
let mediaQuery: MediaQueryList | null = null;

const resolveTheme = (value: ThemePreference): Theme => {
  if (value === 'light' || value === 'dark') return value;
  return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const applySystemTheme = () => {
  if (preference.getSnapshot() === 'system') systemListeners.forEach(listener => listener());
};

const listenToSystemThemeChanges = () => {
  if (mediaQuery || !globalThis.matchMedia) return;
  mediaQuery = globalThis.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', applySystemTheme);
};

const themePreferenceStorage: BaseStorage<ThemePreference> = preference;
const themeStorage: BaseStorage<Theme> & {
  toggle: () => Promise<void>;
  applySystemTheme: () => void;
  listenToSystemThemeChanges: () => void;
} = {
  get: async () => resolveTheme(await preference.get()),
  set: value => preference.set(async previous => (typeof value === 'function' ? value(resolveTheme(previous)) : value)),
  getSnapshot: () => {
    const value = preference.getSnapshot();
    return value === null ? null : resolveTheme(value);
  },
  subscribe: listener => {
    listenToSystemThemeChanges();
    systemListeners.add(listener);
    const unsubscribe = preference.subscribe(listener);
    return () => {
      systemListeners.delete(listener);
      unsubscribe();
    };
  },
  toggle: () => preference.set(previous => (resolveTheme(previous) === 'light' ? 'dark' : 'light')),
  applySystemTheme,
  listenToSystemThemeChanges,
};

export { themeStorage, themePreferenceStorage };
export type { Theme, ThemePreference };
