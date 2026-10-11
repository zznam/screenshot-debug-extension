import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const data: Record<string, unknown> = {};

beforeEach(() => {
  vi.resetModules();
  for (const key of Object.keys(data)) delete data[key];
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: async (keys?: string[]) => {
          if (!keys || keys.length === 0) return { ...data };
          const res: Record<string, unknown> = {};
          for (const k of keys) {
            if (k in data) res[k] = data[k];
          }
          return res;
        },
        set: async (values: Record<string, unknown>) => {
          Object.assign(data, values);
        },
        onChanged: { addListener: vi.fn() },
      },
    },
  });
});

afterEach(() => vi.unstubAllGlobals());

describe('migrateRewindSettings', () => {
  it('forces legacy auto-enabled rewind off while preserving disabled hosts', async () => {
    const { migrateRewindSettings } = await import('./rewind-settings.storage.js');
    expect(
      migrateRewindSettings({
        rewind: { enabled: true, disabledHosts: ['login.example.com'] },
      }),
    ).toEqual({
      rewind: {
        enabled: false,
        consentVersion: 1,
        disabledHosts: ['login.example.com'],
      },
    });
  });

  it('preserves an explicit current-version opt-in', async () => {
    const { migrateRewindSettings } = await import('./rewind-settings.storage.js');
    expect(
      migrateRewindSettings({
        rewind: { enabled: true, consentVersion: 1, disabledHosts: [] },
      }).rewind.enabled,
    ).toBe(true);
  });

  it('defaults new settings to opt-out', async () => {
    const { migrateRewindSettings } = await import('./rewind-settings.storage.js');
    expect(migrateRewindSettings()).toEqual({
      rewind: { enabled: false, consentVersion: 1, disabledHosts: [] },
    });
  });
});

describe('normalizeHost', () => {
  it('normalizes hostnames from raw strings and URLs', async () => {
    const { normalizeHost } = await import('./rewind-settings.storage.js');
    expect(normalizeHost('  EXAMPLE.com  ')).toBe('example.com');
    expect(normalizeHost('https://app.example.com/some/path')).toBe('app.example.com');
    expect(normalizeHost('http://localhost:3000')).toBe('localhost');
    expect(normalizeHost('')).toBe('');
    expect(normalizeHost('   ')).toBe('');
  });
});

describe('rewindSettingsStorage operations', () => {
  it('toggles rewind enabled state atomically', async () => {
    const { rewindSettingsStorage } = await import('./rewind-settings.storage.js');
    await rewindSettingsStorage.setRewindEnabled(true);
    expect(await rewindSettingsStorage.isRewindEnabled()).toBe(true);

    await rewindSettingsStorage.setRewindEnabled(false);
    expect(await rewindSettingsStorage.isRewindEnabled()).toBe(false);
  });

  it('manages disabled hosts with deduplication and case normalization', async () => {
    const { rewindSettingsStorage } = await import('./rewind-settings.storage.js');
    await rewindSettingsStorage.addDisabledHost('  Test.com  ');
    expect(await rewindSettingsStorage.isHostDisabled('test.com')).toBe(true);
    expect(await rewindSettingsStorage.isHostDisabled('TEST.COM')).toBe(true);
    expect(await rewindSettingsStorage.isHostDisabled('https://test.com/path')).toBe(true);

    // Duplicate add should not create duplicates
    await rewindSettingsStorage.addDisabledHost('test.com');
    const hosts = await rewindSettingsStorage.getDisabledHosts();
    expect(hosts.filter(h => h === 'test.com')).toHaveLength(1);

    // Removal
    await rewindSettingsStorage.removeDisabledHost('TEST.com');
    expect(await rewindSettingsStorage.isHostDisabled('test.com')).toBe(false);
  });

  it('returns valid snapshot', async () => {
    const { rewindSettingsStorage } = await import('./rewind-settings.storage.js');
    const snapshot = rewindSettingsStorage.getSnapshot();
    expect(snapshot).not.toBeNull();
    expect(typeof snapshot?.rewind.enabled).toBe('boolean');
    expect(Array.isArray(snapshot?.rewind.disabledHosts)).toBe(true);
  });
});
