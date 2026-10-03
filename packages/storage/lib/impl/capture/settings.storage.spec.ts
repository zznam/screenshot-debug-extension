import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const data: Record<string, unknown> = {};
beforeEach(() => {
  vi.resetModules();
  for (const key of Object.keys(data)) delete data[key];
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: async () => ({ ...data }),
        set: async (values: Record<string, unknown>) => {
          Object.assign(data, values);
        },
        onChanged: { addListener: vi.fn() },
      },
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('capture settings', () => {
  it('fills missing legacy values and clamps invalid quality and retention', async () => {
    const { normalizeCaptureSettings } = await import('./settings.storage.js');
    expect(normalizeCaptureSettings({ screenshotQuality: 900, retentionMinutes: -1 })).toMatchObject({
      screenshotQuality: 100,
      retentionMinutes: 0,
      exportFormat: 'individual',
      screenshotFormat: 'png',
    });
    expect(normalizeCaptureSettings({ screenshotQuality: 10 }).screenshotQuality).toBe(50);
    expect(normalizeCaptureSettings({ screenshotQuality: Number.NaN }).screenshotQuality).toBe(100);
  });
  it('keeps simultaneous settings changes and restores defaults', async () => {
    const { captureSettingsStorage } = await import('./settings.storage.js');
    await Promise.all([
      captureSettingsStorage.updateSettings({ screenshotFormat: 'jpeg' }),
      captureSettingsStorage.updateSettings({ includePerformance: true }),
    ]);
    expect(await captureSettingsStorage.get()).toMatchObject({ screenshotFormat: 'jpeg', includePerformance: true });
    await captureSettingsStorage.resetSettings();
    expect(await captureSettingsStorage.get()).toMatchObject({ screenshotFormat: 'png', includePerformance: false });
  });
});
