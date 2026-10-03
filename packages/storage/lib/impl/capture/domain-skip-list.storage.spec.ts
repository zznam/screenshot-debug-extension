import { describe, expect, it } from 'vitest';

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
