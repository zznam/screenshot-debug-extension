import { describe, expect, it } from 'vitest';

import type { DebugReport } from './report-builder.util';
import { buildReportMarkdown } from './report-markdown.util';
import type { Record as ExtRecord } from '../types';

describe('buildReportMarkdown', () => {
  const sampleReport: DebugReport = {
    meta: {
      version: '1.0.0',
      title: 'Checkout crash on submit',
      url: 'https://example.com/checkout?step=2',
      generatedAt: '2026-10-10T12:00:00.000Z',
    },
    screenshots: [
      { filename: 'screenshot-viewport-1.png', type: 'viewport' },
      { filename: 'screenshot-full-2.png', type: 'full-page' },
    ],
    network: {
      requests: [
        { recordType: 'network', url: 'https://example.com/api/pay', method: 'POST', status: 500, type: 'xhr' },
        { recordType: 'network', url: 'https://example.com/api/user', method: 'GET', status: 200, type: 'xhr' },
      ] as ExtRecord[],
      errors: [
        { recordType: 'network', url: 'https://example.com/api/pay', method: 'POST', status: 500, type: 'xhr' },
      ] as ExtRecord[],
      summary: { total: 2, failed: 1 },
    },
    console: {
      errors: [
        {
          recordType: 'console',
          url: '',
          type: '',
          method: 'error',
          error: { message: 'Unhandled rejection: Payment failed' },
        },
      ] as ExtRecord[],
      warnings: [
        { recordType: 'console', url: '', type: '', method: 'warn', message: 'Slow connection detected' },
      ] as ExtRecord[],
      info: [],
    },
    events: [],
    performance: [],
  };

  it('generates markdown with metadata, errors, and attachments', () => {
    const md = buildReportMarkdown(sampleReport);

    expect(md).toContain('# Checkout crash on submit');
    expect(md).toContain('- Page: https://example.com/checkout?step=2');
    expect(md).toContain('- Captured: 2026-10-10T12:00:00.000Z');
    expect(md).toContain('- Network: 2 requests, 1 failures');
    expect(md).toContain('- Console: 1 errors, 1 warnings');
    expect(md).toContain('Unhandled rejection: Payment failed');
    expect(md).toContain('- POST https://example.com/api/pay — 500');
    expect(md).toContain('- screenshot-viewport-1.png');
    expect(md).toContain('- screenshot-full-2.png');
  });

  it('outputs empty state notes when no errors or attachments exist', () => {
    const emptyReport: DebugReport = {
      meta: {
        version: '1.0.0',
        generatedAt: '2026-10-10T12:00:00.000Z',
        url: 'https://example.com',
      },
      screenshots: [],
      network: {
        requests: [],
        errors: [],
        summary: { total: 0, failed: 0 },
      },
      console: {
        errors: [],
        warnings: [],
        info: [],
      },
      events: [],
      performance: [],
    };

    const md = buildReportMarkdown(emptyReport);

    expect(md).toContain('# Bug report');
    expect(md).toContain('No console errors were captured.');
    expect(md).toContain('No failed requests were captured.');
    expect(md).toContain('No screenshot attachments.');
  });

  it('truncates lists exceeding 20 errors and adds count note', () => {
    const manyErrorsReport: DebugReport = {
      ...sampleReport,
      console: {
        ...sampleReport.console,
        errors: Array.from({ length: 25 }, (_, i) => ({
          recordType: 'console',
          url: '',
          type: '',
          method: 'error',
          error: { message: `Error ${i + 1}` },
        })) as ExtRecord[],
      },
    };

    const md = buildReportMarkdown(manyErrorsReport);

    expect(md).toContain('- Error 1');
    expect(md).toContain('- Error 20');
    expect(md).not.toContain('- Error 21');
    expect(md).toContain('- 5 additional errors in the JSON report.');
  });

  it('escapes markdown special characters in titles and values', () => {
    const escapedReport: DebugReport = {
      ...sampleReport,
      meta: {
        ...sampleReport.meta,
        title: 'Crash in <Component> *bold* [link]',
      },
    };

    const md = buildReportMarkdown(escapedReport);
    expect(md).toContain('\\<Component\\> \\*bold\\* \\[link\\]');
  });
});
