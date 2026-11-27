import { createStorage } from '../../base/base.js';
import { StorageEnum } from '../../base/enums.js';
import type { BaseStorage } from '../../base/types.js';

type ExportFormat = 'individual' | 'zip';
type ScreenshotFormat = 'png' | 'jpeg';

interface CaptureSettings {
  exportFormat: ExportFormat;
  screenshotFormat: ScreenshotFormat;
  screenshotQuality: number; // 50 to 100
  includePerformance: boolean;
  retentionMinutes: number; // 0 means no auto-delete, else e.g. 15, 30, 60
  autoScreenshotOnError: boolean;
  /** Subfolder inside the browser's Downloads folder, e.g. "Bug reports/acme". Empty saves at the top level. */
  downloadFolder: string;
}

const DEFAULT_SETTINGS: CaptureSettings = {
  exportFormat: 'individual',
  screenshotFormat: 'png',
  screenshotQuality: 100,
  includePerformance: false,
  retentionMinutes: 0,
  autoScreenshotOnError: false,
  downloadFolder: '',
};

type CaptureSettingsStorage = BaseStorage<CaptureSettings> & {
  updateSettings: (partial: Partial<CaptureSettings>) => Promise<void>;
  resetSettings: () => Promise<void>;
};

const storage = createStorage<CaptureSettings>('capture-settings-storage-key', DEFAULT_SETTINGS, {
  storageEnum: StorageEnum.Local,
  liveUpdate: true,
});

const MAX_FOLDER_DEPTH = 4;
const MAX_SEGMENT_LENGTH = 60;

/**
 * Turns user input into a relative path chrome.downloads accepts: no drive letters, no `..`,
 * no characters Windows or macOS reject, at most four levels.
 */
const normalizeDownloadFolder = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  return value
    .split(/[\\/]+/)
    .map(segment =>
      Array.from(segment, character =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127 ? '' : character,
      )
        .join('')
        .replace(/[<>:"|?*]/g, '-')
        .trim()
        .replace(/^\.+|\.+$/g, '')
        .trim()
        .slice(0, MAX_SEGMENT_LENGTH)
        .trim(),
    )
    .filter(Boolean)
    .slice(0, MAX_FOLDER_DEPTH)
    .join('/');
};

const normalizeCaptureSettings = (value: Partial<CaptureSettings> | null | undefined): CaptureSettings => ({
  exportFormat: value?.exportFormat === 'zip' ? 'zip' : 'individual',
  screenshotFormat: value?.screenshotFormat === 'jpeg' ? 'jpeg' : 'png',
  screenshotQuality: Number.isFinite(value?.screenshotQuality)
    ? Math.max(50, Math.min(100, Math.round(value!.screenshotQuality!)))
    : DEFAULT_SETTINGS.screenshotQuality,
  includePerformance: value?.includePerformance === true,
  retentionMinutes:
    Number.isFinite(value?.retentionMinutes) && value!.retentionMinutes! >= 0
      ? Math.floor(value!.retentionMinutes!)
      : DEFAULT_SETTINGS.retentionMinutes,
  autoScreenshotOnError: value?.autoScreenshotOnError === true,
  downloadFolder: normalizeDownloadFolder(value?.downloadFolder),
});

let previousSnapshot: CaptureSettings | null = null;
let normalizedSnapshot: CaptureSettings | null = null;

export const captureSettingsStorage: CaptureSettingsStorage = {
  ...storage,
  get: async () => normalizeCaptureSettings(await storage.get()),
  getSnapshot: () => {
    const snapshot = storage.getSnapshot();
    if (snapshot !== previousSnapshot) {
      previousSnapshot = snapshot;
      normalizedSnapshot = snapshot === null ? null : normalizeCaptureSettings(snapshot);
    }
    return normalizedSnapshot;
  },
  updateSettings: async (partial: Partial<CaptureSettings>) => {
    await storage.set(current => normalizeCaptureSettings({ ...normalizeCaptureSettings(current), ...partial }));
  },
  resetSettings: () => storage.set(DEFAULT_SETTINGS),
};

export { normalizeCaptureSettings, normalizeDownloadFolder };
export type { ExportFormat, ScreenshotFormat, CaptureSettings };
