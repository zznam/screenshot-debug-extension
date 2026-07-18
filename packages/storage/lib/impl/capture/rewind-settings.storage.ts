/* eslint-disable import-x/exports-last */
import { createStorage } from '../../base/base.js';
import { StorageEnum } from '../../base/enums.js';
import type { BaseStorage } from '../../base/types.js';

export interface RewindSettings {
  rewind: {
    enabled: boolean;
    consentVersion: number;
    /**
     * User-level per-host overrides.
     * If a host is here, rewind capture should be disabled even if globally enabled.
     * Example: ["example.com", "app.example.com"]
     */
    disabledHosts: string[];
  };
}

const defaultRewindSettings: RewindSettings = {
  rewind: {
    enabled: false,
    consentVersion: 1,
    disabledHosts: [],
  },
};

type LegacyRewindSettings = {
  rewind?: {
    enabled?: boolean;
    consentVersion?: number;
    disabledHosts?: string[];
  };
};

export const migrateRewindSettings = (settings?: LegacyRewindSettings): RewindSettings => {
  const hasCurrentConsent = settings?.rewind?.consentVersion === defaultRewindSettings.rewind.consentVersion;

  return {
    rewind: {
      enabled: hasCurrentConsent ? Boolean(settings?.rewind?.enabled) : false,
      consentVersion: defaultRewindSettings.rewind.consentVersion,
      disabledHosts: Array.isArray(settings?.rewind?.disabledHosts) ? settings.rewind.disabledHosts : [],
    },
  };
};

const baseStorage = createStorage<RewindSettings>('rewind-settings', defaultRewindSettings, {
  storageEnum: StorageEnum.Local,
  liveUpdate: true,
});

export type RewindSettingsStorage = BaseStorage<RewindSettings> & {
  getSettings: () => Promise<RewindSettings>;
  isRewindEnabled: () => Promise<boolean>;
  setRewindEnabled: (enabled: boolean) => Promise<void>;
  getDisabledHosts: () => Promise<string[]>;
  addDisabledHost: (host: string) => Promise<void>;
  removeDisabledHost: (host: string) => Promise<void>;
  isHostDisabled: (host: string) => Promise<boolean>;
};

const normalizeHost = (host: string): string => host.trim().toLowerCase();

const getMigratedSettings = async (): Promise<RewindSettings> => {
  const settings = (await baseStorage.get()) ?? defaultRewindSettings;

  // Existing builds enabled rewind without explicit consent. Migrate those
  // values once and require the user to opt in from the popup.
  if (settings.rewind?.consentVersion !== defaultRewindSettings.rewind.consentVersion) {
    const migrated = migrateRewindSettings(settings);
    await baseStorage.set(migrated);
    return migrated;
  }

  return settings;
};

export const rewindSettingsStorage: RewindSettingsStorage = {
  ...baseStorage,
  get: getMigratedSettings,
  getSettings: getMigratedSettings,

  isRewindEnabled: async () => {
    const settings = await rewindSettingsStorage.getSettings();
    return Boolean(settings.rewind.enabled);
  },

  setRewindEnabled: async (enabled: boolean) => {
    const settings = await rewindSettingsStorage.getSettings();
    await baseStorage.set({
      ...settings,
      rewind: {
        ...settings.rewind,
        enabled: Boolean(enabled),
      },
    });
  },

  getDisabledHosts: async () => {
    const settings = await rewindSettingsStorage.getSettings();
    return Array.isArray(settings.rewind.disabledHosts) ? settings.rewind.disabledHosts : [];
  },

  addDisabledHost: async (host: string) => {
    const normalizedHost = normalizeHost(host);
    if (!normalizedHost) return;

    const settings = await rewindSettingsStorage.getSettings();
    const currentHosts = Array.isArray(settings.rewind.disabledHosts) ? settings.rewind.disabledHosts : [];
    const alreadyDisabled = currentHosts.includes(normalizedHost);

    if (alreadyDisabled) return;

    await baseStorage.set({
      ...settings,
      rewind: {
        ...settings.rewind,
        disabledHosts: [...currentHosts, normalizedHost],
      },
    });
  },

  removeDisabledHost: async (host: string) => {
    const normalizedHost = normalizeHost(host);
    if (!normalizedHost) return;

    const settings = await rewindSettingsStorage.getSettings();
    const currentHosts = Array.isArray(settings.rewind.disabledHosts) ? settings.rewind.disabledHosts : [];

    await baseStorage.set({
      ...settings,
      rewind: {
        ...settings.rewind,
        disabledHosts: currentHosts.filter(existingHost => existingHost !== normalizedHost),
      },
    });
  },

  isHostDisabled: async (host: string) => {
    const normalizedHost = normalizeHost(host);
    if (!normalizedHost) return false;

    const disabledHosts = await rewindSettingsStorage.getDisabledHosts();
    return disabledHosts.includes(normalizedHost);
  },
};

void getMigratedSettings();
