import { describe, expect, it } from 'vitest';

import { buildDebugReport } from './report-builder.util';
import type { Record as ExtRecord } from '../types';

describe('buildDebugReport', () => {
  it('resolves URL from first record with valid url or pageUrl', () => {
    const records: ExtRecord[] = [
      { recordType: 'console', method: 'log', message: 'Hello', url: '', type: '' },
      { recordType: 'network', url: 'https://example.com/api', status: 200, type: 'xhr' },
    ];

    const report = buildDebugReport(records);
    expect(report.meta.url).toBe('https://example.com/api');
  });

  it('falls back to unknown url when records do not specify url', () => {
    const report = buildDebugReport([]);
    expect(report.meta.url).toBe('unknown');
    expect(report.network.summary).toEqual({ total: 0, failed: 0 });
  });

  it('classifies HTTP errors, status 0, and failed flags as network errors', () => {
    const records: ExtRecord[] = [
      { recordType: 'network', url: 'https://example.com/ok', status: 200, type: 'xhr' },
      { recordType: 'network', url: 'https://example.com/not-found', status: 404, type: 'xhr' },
      { recordType: 'network', url: 'https://example.com/blocked', status: 0, type: 'xhr' },
      { recordType: 'network', url: 'https://example.com/failed', status: 200, failed: true, type: 'xhr' },
      { recordType: 'network', url: 'https://example.com/err', type: 'error' },
    ];

    const report = buildDebugReport(records);
    expect(report.network.summary.total).toBe(5);
    expect(report.network.summary.failed).toBe(4);
    expect(report.network.errors.map(r => r.url)).toEqual([
      'https://example.com/not-found',
      'https://example.com/blocked',
      'https://example.com/failed',
      'https://example.com/err',
    ]);
  });

  it('categorizes console messages into errors, warnings, and info', () => {
    const records: ExtRecord[] = [
      { recordType: 'console', method: 'error', error: { message: 'Fatal' }, url: '', type: '' },
      { recordType: 'console', method: 'warn', message: 'Deprecation', url: '', type: '' },
      { recordType: 'console', method: 'warning', message: 'Low memory', url: '', type: '' },
      { recordType: 'console', method: 'log', message: 'Mounted', url: '', type: '' },
      { recordType: 'console', method: 'info', message: 'Rendered', url: '', type: '' },
      { recordType: 'console', method: 'debug', message: 'Trace', url: '', type: '' },
    ];

    const report = buildDebugReport(records);
    expect(report.console.errors.length).toBe(1);
    expect(report.console.warnings.length).toBe(2);
    expect(report.console.info.length).toBe(3);
  });

  it('applies metaOverrides and keeps screenshots', () => {
    const report = buildDebugReport([], {
      title: 'Custom Title',
      screenshots: [{ filename: 'test.png', type: 'viewport' }],
    });

    expect(report.meta.title).toBe('Custom Title');
    expect(report.screenshots).toEqual([{ filename: 'test.png', type: 'viewport' }]);
  });
});
