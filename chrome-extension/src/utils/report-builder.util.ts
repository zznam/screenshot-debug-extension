import type { Record as ExtRecord } from '@src/types';

export interface DebugReport {
  meta: {
    version: string;
    generatedAt: string;
    url: string;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  };
  screenshots: Array<{
    filename: string;
    type: 'cropped' | 'full-page' | 'viewport';
  }>;
  network: {
    requests: ExtRecord[];
    errors: ExtRecord[];
    summary: { total: number; failed: number };
  };
  console: {
    errors: ExtRecord[];
    warnings: ExtRecord[];
    info: ExtRecord[];
  };
  events: ExtRecord[];
  performance: ExtRecord[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const buildDebugReport = (records: ExtRecord[], metaOverrides: Record<string, any> = {}): DebugReport => {
  const networkRequests = records.filter(r => r.recordType === 'network');
  const networkErrors = networkRequests.filter(r => {
    const code = Number(r.status ?? r.statusCode);
    return code >= 400 || code === 0 || r.type === 'error' || r.failed === true;
  });

  const consoleRecords = records.filter(r => r.recordType === 'console');
  const consoleErrors = consoleRecords.filter(r => r.method === 'error');
  const consoleWarnings = consoleRecords.filter(r => r.method === 'warn' || r.method === 'warning');
  const consoleInfo = consoleRecords.filter(r => ['log', 'info', 'debug'].includes(r.method as string));

  const eventRecords = records.filter(r => r.recordType === 'events');
  const performanceRecords = records.filter(r => r.recordType === 'performance');

  const resolvedUrl =
    records.find(r => typeof r.url === 'string' && r.url.length > 0)?.url ||
    records.find(r => typeof r.pageUrl === 'string' && r.pageUrl.length > 0)?.pageUrl ||
    'unknown';

  return {
    meta: {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      url: resolvedUrl,
      ...metaOverrides,
    },
    screenshots: Array.isArray(metaOverrides.screenshots) ? metaOverrides.screenshots : [],
    network: {
      requests: networkRequests,
      errors: networkErrors,
      summary: {
        total: networkRequests.length,
        failed: networkErrors.length,
      },
    },
    console: {
      errors: consoleErrors,
      warnings: consoleWarnings,
      info: consoleInfo,
    },
    events: eventRecords,
    performance: performanceRecords,
  };
};
