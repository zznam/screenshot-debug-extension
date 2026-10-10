import { describe, expect, it } from 'vitest';

import type { RecordingSettings } from './recording-settings.storage.js';
import { defaultRecordingSettings, normalizeRecordingSettings } from './recording-settings.storage.js';

describe('recording-settings.storage', () => {
  describe('normalizeRecordingSettings', () => {
    it('returns default settings when input is undefined or null', () => {
      expect(normalizeRecordingSettings()).toEqual(defaultRecordingSettings);
      expect(normalizeRecordingSettings(null)).toEqual(defaultRecordingSettings);
    });

    it('populates missing fields with default values', () => {
      const normalized = normalizeRecordingSettings({
        mic: {
          enabled: false,
        } as unknown as RecordingSettings['mic'],
      });

      expect(normalized).toEqual({
        mic: {
          enabled: false,
          permission: 'unknown',
          activeTrack: false,
          muted: false,
        },
      });
    });

    it('preserves valid custom recording settings', () => {
      const custom = {
        mic: {
          enabled: true,
          permission: 'granted' as const,
          activeTrack: true,
          muted: true,
        },
      };

      expect(normalizeRecordingSettings(custom)).toEqual(custom);
    });

    it('falls back to default permission for invalid permission strings', () => {
      const normalized = normalizeRecordingSettings({
        mic: {
          enabled: true,
          permission: 'unsupported-perm' as unknown as RecordingSettings['mic']['permission'],
          activeTrack: false,
          muted: false,
        },
      });

      expect(normalized.mic.permission).toBe('unknown');
    });
  });
});
