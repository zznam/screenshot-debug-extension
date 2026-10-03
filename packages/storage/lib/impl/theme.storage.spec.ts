import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => vi.unstubAllGlobals());
describe('theme preferences', () => {
  it('keeps system as the preference and respects explicit overrides when the OS changes', async () => {
    vi.resetModules();
    const data: Record<string, unknown> = { 'theme-storage-key': 'system' };
    let dark = true;
    const addEventListener = vi.fn();
    vi.stubGlobal('matchMedia', () => ({ matches: dark, addEventListener }));
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
    const { themeStorage, themePreferenceStorage } = await import('./theme.storage.js');
    await vi.waitFor(() => expect(themeStorage.getSnapshot()).toBe('dark'));
    const listener = vi.fn();
    const unsubscribe = themeStorage.subscribe(listener);
    themeStorage.listenToSystemThemeChanges();
    expect(addEventListener).toHaveBeenCalledOnce();
    dark = false;
    addEventListener.mock.calls[0][1]();
    expect(themeStorage.getSnapshot()).toBe('light');
    expect(await themePreferenceStorage.get()).toBe('system');
    await themeStorage.set('dark');
    listener.mockClear();
    dark = true;
    addEventListener.mock.calls[0][1]();
    expect(listener).not.toHaveBeenCalled();
    expect(await themePreferenceStorage.get()).toBe('dark');
    await themeStorage.toggle();
    expect(await themeStorage.get()).toBe('light');
    unsubscribe();
  });
});
