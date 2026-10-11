import { describe, expect, it, vi } from 'vitest';

import { matchesSkippedDomain, normalizeDomain } from './domain-skip-list.storage.js';

describe('domain skip rules', () => {
  it('normalizes URLs, IDNs, case, ports, paths, and trailing dots', () => {
    expect(normalizeDomain(' HTTPS://Example.COM.:8443/private ')).toBe('example.com');
    expect(normalizeDomain('bücher.de')).toBe('xn--bcher-kva.de');
    expect(normalizeDomain('localhost:3000')).toBe('localhost');
  });
  it.each(['', '*.example.com', 'two words.com', 'file://example.com', 'https://user:pass@example.com'])(
    'rejects invalid domain %s',
    domain => {
      expect(() => normalizeDomain(domain)).toThrow();
    },
  );
  it('matches only the domain and actual subdomains', () => {
    expect(matchesSkippedDomain('https://app.example.com/', ['example.com'])).toBe(true);
    expect(matchesSkippedDomain('https://example.com/', ['EXAMPLE.COM'])).toBe(true);
    expect(matchesSkippedDomain('https://notexample.com/', ['example.com'])).toBe(false);
    expect(matchesSkippedDomain('https://example.com.evil.test/', ['example.com'])).toBe(false);
    expect(matchesSkippedDomain('bad-url', ['example.com'])).toBe(false);
    expect(matchesSkippedDomain('https://example.com/', ['bad domain'])).toBe(false);
  });
});

describe('domainSkipListStorage operations', () => {
  const store = new Map<string, unknown>();

  it('adds and removes domains with case and URL normalization', async () => {
    vi.resetModules();
    store.clear();
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: async (keys?: string[]) => {
            if (!keys || keys.length === 0) return { ...Object.fromEntries(store) };
            const res: Record<string, unknown> = {};
            for (const k of keys) {
              if (store.has(k)) res[k] = store.get(k);
            }
            return res;
          },
          set: async (values: Record<string, unknown>) => {
            for (const [k, v] of Object.entries(values)) store.set(k, v);
          },
          onChanged: { addListener: vi.fn() },
        },
      },
    });

    const { domainSkipListStorage: storageInstance } = await import('./domain-skip-list.storage.js');

    await storageInstance.addDomain('https://Example.COM:8080');
    expect(await storageInstance.isDomainSkipped('https://sub.example.com/page')).toBe(true);
    expect(await storageInstance.isDomainSkipped('https://other.com')).toBe(false);

    // Duplicate add should deduplicate
    await storageInstance.addDomain('example.com');
    expect(await storageInstance.get()).toEqual(['example.com']);

    // Remove by URL or uppercase domain
    await storageInstance.removeDomain('HTTPS://EXAMPLE.COM/PATH');
    expect(await storageInstance.isDomainSkipped('https://sub.example.com/page')).toBe(false);
    expect(await storageInstance.get()).toEqual([]);

    vi.unstubAllGlobals();
  });
});
