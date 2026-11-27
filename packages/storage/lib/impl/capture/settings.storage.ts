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
/** Longer input cannot produce a longer result, so bound the work before normalizing. */
const MAX_FOLDER_INPUT = (MAX_SEGMENT_LENGTH + 1) * 16;

/** Strips leading and trailing dots and spaces in linear time (no backtracking regex). */
const trimDotsAndSpaces = (segment: string) => {
  const removable = (character: string) => character === '.' || character.trim() === '';
  let start = 0;
  let end = segment.length;
  while (start < end && removable(segment[start])) start++;
  while (end > start && removable(segment[end - 1])) end--;
  return segment.slice(start, end);
};

/**
 * Turns user input into a relative path chrome.downloads accepts: no `.` or `..` segments, no
 * characters Windows or macOS reject (a drive letter like `C:` becomes a plain `C-` folder), and
 * at most four levels.
 */
const normalizeDownloadFolder = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  return value
    .slice(0, MAX_FOLDER_INPUT)
    .split(/[\\/]/)
    .map(segment =>
      trimDotsAndSpaces(
        trimDotsAndSpaces(
          Array.from(segment, character =>
            character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127 ? '' : character,
          )
            .join('')
            .replace(/[<>:"|?*]/g, '-'),
        ).slice(0, MAX_SEGMENT_LENGTH),
      ),
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
