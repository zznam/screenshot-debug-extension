import { createStorage } from '../../base/base.js';
import { StorageEnum } from '../../base/enums.js';
import type { BaseStorage } from '../../base/types.js';

type MicPermission = 'unknown' | 'granted' | 'denied';

interface RecordingSettings {
  mic: {
    enabled: boolean;
    permission: MicPermission;
    activeTrack: boolean;
    muted: boolean;
  };
}

const defaultRecordingSettings: RecordingSettings = {
  mic: {
    enabled: true,
    permission: 'unknown',
    activeTrack: false,
    muted: false,
  },
};

const normalizeRecordingSettings = (value?: Partial<RecordingSettings> | null): RecordingSettings => {
  const mic = value?.mic;
  const permission: MicPermission =
    mic?.permission === 'granted' || mic?.permission === 'denied' || mic?.permission === 'unknown'
      ? mic.permission
      : defaultRecordingSettings.mic.permission;

  return {
    mic: {
      enabled: typeof mic?.enabled === 'boolean' ? mic.enabled : defaultRecordingSettings.mic.enabled,
      permission,
      activeTrack: typeof mic?.activeTrack === 'boolean' ? mic.activeTrack : defaultRecordingSettings.mic.activeTrack,
      muted: typeof mic?.muted === 'boolean' ? mic.muted : defaultRecordingSettings.mic.muted,
    },
  };
};

const storage = createStorage<RecordingSettings>('recording-settings', defaultRecordingSettings, {
  storageEnum: StorageEnum.Local,
  liveUpdate: true,
});

type RecordingSettingsStorage = BaseStorage<RecordingSettings> & {
  setMicEnabled: (enabled: boolean) => Promise<void>;
  setMicPermission: (perm: MicPermission) => Promise<void>;
  setMicActiveTrack: (active: boolean) => Promise<void>;
  setMicMuted: (muted: boolean) => Promise<void>;
  getSettings: () => Promise<RecordingSettings>;
};

const recordingSettingsStorage: RecordingSettingsStorage = {
  ...storage,

  get: async () => normalizeRecordingSettings(await storage.get()),

  getSnapshot: () => {
    const snapshot = storage.getSnapshot();
    return snapshot ? normalizeRecordingSettings(snapshot) : defaultRecordingSettings;
  },

  async setMicEnabled(enabled: boolean) {
    await storage.set(current => {
      const normalized = normalizeRecordingSettings(current);
      return {
        ...normalized,
        mic: { ...normalized.mic, enabled },
      };
    });
  },

  async setMicPermission(permission: MicPermission) {
    await storage.set(current => {
      const normalized = normalizeRecordingSettings(current);
      return {
        ...normalized,
        mic: { ...normalized.mic, permission },
      };
    });
  },

  async setMicActiveTrack(active: boolean) {
    await storage.set(current => {
      const normalized = normalizeRecordingSettings(current);
      return {
        ...normalized,
        mic: { ...normalized.mic, activeTrack: active },
      };
    });
  },

  async setMicMuted(muted: boolean) {
    await storage.set(current => {
      const normalized = normalizeRecordingSettings(current);
      return {
        ...normalized,
        mic: { ...normalized.mic, muted },
      };
    });
  },

  async getSettings() {
    return normalizeRecordingSettings(await storage.get());
  },
};

export { defaultRecordingSettings, normalizeRecordingSettings, recordingSettingsStorage };
export type { MicPermission, RecordingSettings, RecordingSettingsStorage };
