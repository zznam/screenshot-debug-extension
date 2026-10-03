import type { DebugReport } from './report-builder.util';

const text = (value: unknown): string => {
  const serialized = typeof value === 'string' ? value : (JSON.stringify(value) ?? '');
  return serialized
    .replace(/[\r\n]+/g, ' ')
    .replace(/[\\`*_[\]<>]/g, '\\$&')
    .slice(0, 800);
};

export const buildReportMarkdown = (report: DebugReport): string => {
  const lines = [
    `# ${text(report.meta.title || 'Bug report')}`,
    '',
    `- Page: ${text(report.meta.url)}`,
    `- Captured: ${text(report.meta.generatedAt)}`,
    `- Network: ${report.network.summary.total} requests, ${report.network.summary.failed} failures`,
    `- Console: ${report.console.errors.length} errors, ${report.console.warnings.length} warnings`,
    '',
    '## Steps to reproduce',
    '',
    '1. [Describe the action that triggered the issue.]',
    '',
    '## Expected behavior',
    '',
    '[Describe what should happen.]',
    '',
    '## Actual behavior',
    '',
    '[Describe what happened.]',
    '',
    '## Console errors',
    '',
  ];
  if (!report.console.errors.length) lines.push('No console errors were captured.');
  for (const record of report.console.errors.slice(0, 20)) {
    lines.push(`- ${text(record.error?.message ?? record.args ?? record.message ?? 'Console error')}`);
  }
  if (report.console.errors.length > 20)
    lines.push(`- ${report.console.errors.length - 20} additional errors in the JSON report.`);
  lines.push('', '## Failed requests', '');
  if (!report.network.errors.length) lines.push('No failed requests were captured.');
  for (const record of report.network.errors.slice(0, 20)) {
    lines.push(
      `- ${text(record.method || 'GET')} ${text(record.url)} — ${text(record.status ?? record.statusCode ?? record.type)}`,
    );
  }
  if (report.network.errors.length > 20)
    lines.push(`- ${report.network.errors.length - 20} additional failures in the JSON report.`);
  lines.push(
    '',
    '## Attachments',
    '',
    ...report.screenshots.map(screenshot => `- ${text(screenshot.filename)}`),
    '',
    'The JSON report and network.har contain structured diagnostics. Review attachments before sharing.',
    '',
  );
  return lines.join('\n');
};
