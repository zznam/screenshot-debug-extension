import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it, vi } from 'vitest';

import { comparePixels } from './image-tools';
import { buildReviewedZip, reportMarkdown, sanitizeRecord, sensitiveFindings } from './review-export';

vi.mock('@extension/shared', async () => {
  const { deepRedactSensitiveInfo } = await import('../../../packages/shared/lib/utils/redact-sensitive-info.util');
  return { deepRedactSensitiveInfo };
});

const fields = {
  title: 'Checkout issue',
  steps: 'Click Pay',
  expected: 'Order confirmed',
  actual: 'Payment failed',
  sourceUrl: '',
};
describe('reviewed evidence boundary', () => {
  it('redacts nested credentials, localhost URLs and email addresses without changing saved evidence', () => {
    const original = {
      url: 'http://localhost/?token=very-private-token',
      headers: { Authorization: 'Bearer private-value' },
      message: 'Contact alice@example.com',
      nested: { password: 'hunter2' },
    };
    const sanitized = JSON.stringify(sanitizeRecord(original));
    expect(sanitized).not.toMatch(/very-private-token|private-value|alice@example.com|hunter2/);
    expect(original.nested.password).toBe('hunter2');
    expect(sensitiveFindings(JSON.stringify(original))).toEqual(['Email addresses', 'Credentials or sensitive fields']);
  });
  it('includes only explicitly supplied diagnostics and no capture documents or OCR text', async () => {
    const zip = await buildReviewedZip(fields, [], [{ message: 'Selected', token: 'secret' }]);
    const files = unzipSync(new Uint8Array(await zip.arrayBuffer()));
    expect(Object.keys(files)).toEqual(['report.md', 'diagnostics.json']);
    expect(strFromU8(files['diagnostics.json']!)).toContain('Selected');
    expect(strFromU8(files['diagnostics.json']!)).not.toContain('secret');
    expect(strFromU8(files['report.md']!)).toContain('Click Pay');
    const empty = unzipSync(new Uint8Array(await (await buildReviewedZip(fields, [], [])).arrayBuffer()));
    expect(Object.keys(empty)).toEqual(['report.md']);
  });
  it('escapes raw markup and redacts report fields and source URLs', () => {
    const markdown = reportMarkdown(
      {
        ...fields,
        title: '<script>unsafe</script>',
        actual: 'alice@example.com password=supersecret',
        sourceUrl: 'https://example.com/?token=secret',
      },
      2,
    );
    expect(markdown).not.toContain('<script>');
    expect(markdown).not.toMatch(/alice@example.com|supersecret|token=secret/);
    expect(markdown).toContain('screenshot-2.png');
  });
});
describe('sampled pixel comparison', () => {
  it('reports identical pixels and detects color and alpha changes', () => {
    const pixels = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]);
    expect(comparePixels(pixels, pixels).percent).toBe(0);
    expect(comparePixels(pixels, new Uint8ClampedArray([255, 255, 255, 255, 100, 0, 0, 255])).percent).toBe(50);
    expect(comparePixels(pixels, new Uint8ClampedArray([255, 255, 255, 0, 0, 0, 0, 255])).percent).toBe(50);
    expect(() => comparePixels(pixels, new Uint8ClampedArray(4))).toThrow('matching');
  });
});
