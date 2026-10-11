import { describe, expect, it } from 'vitest';

import { isNonProduction } from './is-non-production.util.js';

describe('isNonProduction', () => {
  it('detects localhost with and without protocol and ports', () => {
    expect(isNonProduction('http://localhost:3000')).toBe(true);
    expect(isNonProduction('https://localhost:8080/dashboard')).toBe(true);
    expect(isNonProduction('localhost:3000')).toBe(true);
    expect(isNonProduction('localhost')).toBe(true);
    expect(isNonProduction('http://sub.localhost:3000')).toBe(true);
  });

  it('detects loopback IPv4 and IPv6 addresses', () => {
    expect(isNonProduction('http://127.0.0.1:5173')).toBe(true);
    expect(isNonProduction('127.0.0.1:3000')).toBe(true);
    expect(isNonProduction('http://0.0.0.0:8000')).toBe(true);
    expect(isNonProduction('http://[::1]:3000')).toBe(true);
  });

  it('detects .local and .test development domains', () => {
    expect(isNonProduction('http://myapp.local:3000')).toBe(true);
    expect(isNonProduction('https://api.myapp.test')).toBe(true);
  });

  it('rejects public production hosts and lookalike domains', () => {
    expect(isNonProduction('https://example.com')).toBe(false);
    expect(isNonProduction('https://localhost.attacker.com')).toBe(false);
    expect(isNonProduction('https://notlocalhost.com')).toBe(false);
    expect(isNonProduction('https://127.0.0.1.evil.com')).toBe(false);
    expect(isNonProduction('https://google.com?redirect=localhost')).toBe(false);
  });

  it('handles empty, undefined, and invalid inputs safely', () => {
    expect(isNonProduction('')).toBe(false);
    expect(isNonProduction('   ')).toBe(false);
    expect(isNonProduction(undefined)).toBe(false);
    expect(isNonProduction('invalid://url%%')).toBe(false);
  });
});
