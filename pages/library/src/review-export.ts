import { strToU8, zipSync } from 'fflate';

import { deepRedactSensitiveInfo } from '@extension/shared';

import { flattenImage } from './image-tools';
import type { Mask } from './image-tools';

interface ReportFields {
  title: string;
  steps: string;
  expected: string;
  actual: string;
  sourceUrl: string;
}
interface ReviewedImage {
  blob: Blob;
  masks: Mask[];
}

const sanitizeText = (text: string): string =>
  deepRedactSensitiveInfo(text, 'https://share-review.example')
    .replace(
      /\b(password|passwd|pwd|token|secret|api[_-]?key|authorization|access[_-]?token|refresh[_-]?token)(["'\s]*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;&}]+)/gi,
      '$1$2[REDACTED]',
    )
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[REDACTED_EMAIL]');
const sanitizeRecord = (value: unknown): unknown =>
  JSON.parse(
    JSON.stringify(deepRedactSensitiveInfo(value, 'https://share-review.example')) ?? 'null',
    (_key, item: unknown) => (typeof item === 'string' ? sanitizeText(item) : item),
  );
const sensitiveFindings = (text: string) =>
  [
    /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(text) ? 'Email addresses' : '',
    /(?:bearer\s+[\w.-]+|(?:password|token|secret|api[_-]?key)["'\s]*[:=])/i.test(text)
      ? 'Credentials or sensitive fields'
      : '',
  ].filter(Boolean);
const markdownText = (text: string) => sanitizeText(text).replace(/([\\`*_[\]<>#])/g, '\\$1');
const reportMarkdown = (fields: ReportFields, imageCount: number) =>
  [
    `# ${markdownText(fields.title).replace(/[\r\n]+/g, ' ')}`,
    fields.sourceUrl ? `Page: ${markdownText(fields.sourceUrl)}` : '',
    '## Steps to reproduce',
    markdownText(fields.steps),
    '## Expected behavior',
    markdownText(fields.expected),
    '## Actual behavior',
    markdownText(fields.actual),
    '## Reviewed attachments',
    ...Array.from({ length: imageCount }, (_, index) => `![Screenshot ${index + 1}](screenshot-${index + 1}.png)`),
    'Only selected, reviewed evidence is included. Diagnostic records are in diagnostics.json when selected.',
  ].join('\n\n') + '\n';

const buildReviewedZip = async (fields: ReportFields, images: ReviewedImage[], records: unknown[]): Promise<Blob> => {
  const files: Record<string, Uint8Array> = { 'report.md': strToU8(reportMarkdown(fields, images.length)) };
  for (const [index, image] of images.entries()) {
    const flattened = await flattenImage(image.blob, image.masks);
    files[`screenshot-${index + 1}.png`] = new Uint8Array(await flattened.arrayBuffer());
  }
  if (records.length) files['diagnostics.json'] = strToU8(JSON.stringify(records.map(sanitizeRecord), null, 2));
  // Never serialize capture documents: they contain hidden originals, layers and OCR text.
  return new Blob([Uint8Array.from(zipSync(files))], { type: 'application/zip' });
};

export { buildReviewedZip, reportMarkdown, sanitizeRecord, sanitizeText, sensitiveFindings };
export type { ReportFields, ReviewedImage };
