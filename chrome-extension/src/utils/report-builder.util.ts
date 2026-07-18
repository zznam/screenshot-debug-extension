import type { Record as ExtRecord } from '@src/types';

export interface DebugReport {
  meta: {
    version: string;
    generatedAt: string;
    url: string;
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

export const buildDebugReport = (records: ExtRecord[], metaOverrides: Record<string, any> = {}): DebugReport => {
  const networkRequests = records.filter(r => r.recordType === 'network');
  const networkErrors = networkRequests.filter(r => (r.status && r.status >= 400) || r.type === 'error');

  const consoleRecords = records.filter(r => r.recordType === 'console');
  const consoleErrors = consoleRecords.filter(r => r.method === 'error');
  const consoleWarnings = consoleRecords.filter(r => r.method === 'warn');
  const consoleInfo = consoleRecords.filter(r => ['log', 'info', 'debug'].includes(r.method as string));

  const eventRecords = records.filter(r => r.recordType === 'events');
  const performanceRecords = records.filter(r => r.recordType === 'performance');

  return {
    meta: {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      url: records[0]?.url || 'unknown',
      ...metaOverrides,
    },
    screenshots: [],
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
