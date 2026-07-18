import { describe, expect, it } from 'vitest';

import { migrateRewindSettings } from './rewind-settings.storage.js';

describe('migrateRewindSettings', () => {
  it('forces legacy auto-enabled rewind off while preserving disabled hosts', () => {
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

  it('preserves an explicit current-version opt-in', () => {
    expect(
      migrateRewindSettings({
        rewind: { enabled: true, consentVersion: 1, disabledHosts: [] },
      }).rewind.enabled,
    ).toBe(true);
  });

  it('defaults new settings to opt-out', () => {
    expect(migrateRewindSettings()).toEqual({
      rewind: { enabled: false, consentVersion: 1, disabledHosts: [] },
    });
  });
});
