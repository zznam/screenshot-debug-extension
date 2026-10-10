import { describe, expect, it } from 'vitest';

import { captureNotifyStorage, defaultNotifyState } from './notify.storage.js';

describe('captureNotifyStorage', () => {
  it('has default notified property set to false', () => {
    expect(defaultNotifyState).toEqual({ notified: false });
  });

  it('exposes setNotified and reset methods', () => {
    expect(typeof captureNotifyStorage.setNotified).toBe('function');
    expect(typeof captureNotifyStorage.reset).toBe('function');
  });
});
