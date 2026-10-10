import type { DebugReport } from './report-builder.util';

const text = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const serialized = typeof value === 'string' ? value : (JSON.stringify(value) ?? '');
  return serialized
    .replace(/[\r\n]+/g, ' ')
    .replace(/[\\`*_[\]<>]/g, '\\$&')
    .slice(0, 800);
};

export const buildReportMarkdown = (report: DebugReport): string => {
  const meta = report?.meta ?? ({} as DebugReport['meta']);
  const network = report?.network ?? { requests: [], errors: [], summary: { total: 0, failed: 0 } };
  const consoleData = report?.console ?? { errors: [], warnings: [], info: [] };
  const consoleErrors = consoleData.errors ?? [];
  const consoleWarnings = consoleData.warnings ?? [];
  const networkErrors = network.errors ?? [];
  const networkRequests = network.requests ?? [];
  const totalRequests = network.summary?.total ?? networkRequests.length;
  const failedRequests = network.summary?.failed ?? networkErrors.length;
  const screenshots = report?.screenshots ?? [];

  const lines = [
    `# ${text(meta.title || 'Bug report')}`,
    '',
    `- Page: ${text(meta.url || 'unknown')}`,
    `- Captured: ${text(meta.generatedAt || '')}`,
    `- Network: ${totalRequests} requests, ${failedRequests} failures`,
    `- Console: ${consoleErrors.length} errors, ${consoleWarnings.length} warnings`,
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

  if (!consoleErrors.length) lines.push('No console errors were captured.');
  for (const record of consoleErrors.slice(0, 20)) {
    lines.push(`- ${text(record.error?.message ?? record.args ?? record.message ?? 'Console error')}`);
  }
  if (consoleErrors.length > 20) lines.push(`- ${consoleErrors.length - 20} additional errors in the JSON report.`);

  lines.push('', '## Failed requests', '');
  if (!networkErrors.length) lines.push('No failed requests were captured.');
  for (const record of networkErrors.slice(0, 20)) {
    lines.push(
      `- ${text(record.method || 'GET')} ${text(record.url)} — ${text(record.status ?? record.statusCode ?? record.type ?? 'Error')}`,
    );
  }
  if (networkErrors.length > 20) lines.push(`- ${networkErrors.length - 20} additional failures in the JSON report.`);

  lines.push('', '## Attachments', '');
  if (screenshots.length > 0) {
    for (const screenshot of screenshots) {
      lines.push(`- ${text(screenshot.filename)}`);
    }
  } else {
    lines.push('No screenshot attachments.');
  }

  lines.push(
    '',
    'The JSON report and network.har contain structured diagnostics. Review attachments before sharing.',
    '',
  );
  return lines.join('\n');
};
