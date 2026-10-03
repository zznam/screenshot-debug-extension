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
}

const DEFAULT_SETTINGS: CaptureSettings = {
  exportFormat: 'individual',
  screenshotFormat: 'png',
  screenshotQuality: 100,
  includePerformance: false,
  retentionMinutes: 0,
  autoScreenshotOnError: false,
};

type CaptureSettingsStorage = BaseStorage<CaptureSettings> & {
  updateSettings: (partial: Partial<CaptureSettings>) => Promise<void>;
  resetSettings: () => Promise<void>;
};

const storage = createStorage<CaptureSettings>('capture-settings-storage-key', DEFAULT_SETTINGS, {
  storageEnum: StorageEnum.Local,
  liveUpdate: true,
});

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

export { normalizeCaptureSettings };
export type { ExportFormat, ScreenshotFormat, CaptureSettings };
