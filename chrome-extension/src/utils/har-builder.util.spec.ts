import { describe, it, expect } from 'vitest';

import type { Record as ExtRecord } from '@src/types';

import { buildHarLog } from './har-builder.util';

describe('buildHarLog', () => {
  it('should filter non-network records', () => {
    const records: ExtRecord[] = [
      { id: '1', recordType: 'network', type: 'xmlhttprequest', url: 'https://api.example.com/data', method: 'GET' },
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
        url: 'https://api.example.com/login',
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
    expect(entry.request.url).toBe('https://api.example.com/login');
    expect(entry.request.postData?.text).toBe(JSON.stringify({ user: 'test' }));

    expect(entry.response.status).toBe(201);
    expect(entry.response.content.text).toBe(JSON.stringify({ token: '123' }));

    expect(entry.time).toBe(150);
  });
});
