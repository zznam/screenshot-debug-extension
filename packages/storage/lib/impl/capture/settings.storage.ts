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
};

const storage = createStorage<CaptureSettings>('capture-settings-storage-key', DEFAULT_SETTINGS, {
  storageEnum: StorageEnum.Local,
});

export const captureSettingsStorage: CaptureSettingsStorage = {
  ...storage,
  updateSettings: async (partial: Partial<CaptureSettings>) => {
    const current = await storage.get();
    await storage.set({ ...current, ...partial });
  },
};

export type { ExportFormat, ScreenshotFormat, CaptureSettings };
