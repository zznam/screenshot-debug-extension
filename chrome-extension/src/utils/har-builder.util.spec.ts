import { describe, it, expect } from 'vitest';

import type { Record as ExtRecord } from '@src/types';

import { buildHarLog, extractHarQueryString, formatIsoTimestamp } from './har-builder.util';

describe('formatIsoTimestamp', () => {
  it('formats valid timestamps to ISO string', () => {
    const fixed = 1700000000000;
    expect(formatIsoTimestamp(fixed)).toBe(new Date(fixed).toISOString());
  });

  it('handles null, undefined, and NaN gracefully without throwing', () => {
    expect(() => formatIsoTimestamp(undefined)).not.toThrow();
    expect(() => formatIsoTimestamp(null)).not.toThrow();
    expect(() => formatIsoTimestamp(NaN)).not.toThrow();
    expect(() => formatIsoTimestamp('invalid-date')).not.toThrow();
  });
});

describe('extractHarQueryString', () => {
  it('extracts query parameters from full URLs and paths', () => {
    expect(extractHarQueryString('https://api.example.com/search?q=test&page=2')).toEqual([
      { name: 'q', value: 'test' },
      { name: 'page', value: '2' },
    ]);

    expect(extractHarQueryString('/items?category=books')).toEqual([{ name: 'category', value: 'books' }]);
  });

  it('returns empty array when URL has no query params or is empty', () => {
    expect(extractHarQueryString('https://api.example.com/users')).toEqual([]);
    expect(extractHarQueryString('')).toEqual([]);
    expect(extractHarQueryString(undefined)).toEqual([]);
  });
});

describe('buildHarLog', () => {
  it('should filter non-network records', () => {
    const records: ExtRecord[] = [
      { id: '1', recordType: 'network', type: 'xmlhttprequest', url: 'https://api.example.com/data', method: 'GET' },

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { id: '2', recordType: 'console', url: 'https://example.com' } as any,
    ];

    const result = buildHarLog(records, 'https://example.com');
    expect(result.log.entries).toHaveLength(1);
    expect(result.log.entries[0].request.url).toBe('https://api.example.com/data');
  });

  it('should map request and response properties correctly', () => {
    const timestamp = Date.now();
    const records: ExtRecord[] = [
      {
        id: '1',
        recordType: 'network',
        type: 'xmlhttprequest',
        url: 'https://api.example.com/login?redirect=dashboard',
        method: 'POST',
        status: 201,
        duration: 150,
        timestamp,
        requestBody: { parsed: { user: 'test' } },
        responseBody: { token: '123' },
      },
    ];

    const result = buildHarLog(records, 'https://example.com');
    const entry = result.log.entries[0];

    expect(entry.request.method).toBe('POST');
    expect(entry.request.url).toBe('https://api.example.com/login?redirect=dashboard');
    expect(entry.request.queryString).toEqual([{ name: 'redirect', value: 'dashboard' }]);
    expect(entry.request.postData?.text).toBe(JSON.stringify({ user: 'test' }));

    expect(entry.response.status).toBe(201);
    expect(entry.response.content.text).toBe(JSON.stringify({ token: '123' }));

    expect(entry.time).toBe(150);
  });

  it('handles empty responseBody without outputting "{}"', () => {
    const records: ExtRecord[] = [
      {
        id: '1',
        recordType: 'network',
        type: 'xmlhttprequest',
        url: 'https://api.example.com/ping',
        method: 'GET',
        responseBody: undefined,
      },
    ];

    const result = buildHarLog(records, 'https://example.com');
    expect(result.log.entries[0].response.content.text).toBe('');
  });
});
