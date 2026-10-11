import type { Record as ExtRecord } from '@src/types';

export const formatIsoTimestamp = (timestamp?: number | string | null): string => {
  if (!timestamp) return new Date().toISOString();
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};

export const extractHarQueryString = (rawUrl?: string): Array<{ name: string; value: string }> => {
  if (!rawUrl) return [];
  try {
    const urlObj = new URL(rawUrl.includes('://') ? rawUrl : `http://localhost/${rawUrl.replace(/^\/+/, '')}`);
    const result: Array<{ name: string; value: string }> = [];
    urlObj.searchParams.forEach((value, name) => {
      result.push({ name, value });
    });
    return result;
  } catch {
    return [];
  }
};

export const buildHarLog = (records: ExtRecord[], url: string) => {
  const networkRequests = records.filter(r => r.recordType === 'network');

  const entries = networkRequests.map(req => {
    // Basic mapping of our simplified Record to HAR 1.2 entry format
    return {
      startedDateTime: formatIsoTimestamp(req.timestamp),
      time: typeof req.duration === 'number' && Number.isFinite(req.duration) ? req.duration : -1,
      request: {
        method: req.method || 'GET',
        url: req.url || '',
        httpVersion: 'HTTP/1.1',
        cookies: [],
        headers: [],
        queryString: extractHarQueryString(req.url),
        postData: req.requestBody
          ? {
              mimeType: 'application/json',
              text:
                typeof req.requestBody.parsed === 'string'
                  ? req.requestBody.parsed
                  : JSON.stringify(req.requestBody.parsed ?? req.requestBody.raw ?? {}),
            }
          : undefined,
        headersSize: -1,
        bodySize: req.requestBody ? JSON.stringify(req.requestBody).length : -1,
      },
      response: {
        status: req.status ?? req.statusCode ?? 0,
        statusText: req.statusText ?? '',
        httpVersion: 'HTTP/1.1',
        cookies: [],
        headers: [],
        content: {
          size: req.responseBody ? JSON.stringify(req.responseBody).length : -1,
          mimeType: 'application/json',
          text:
            req.responseBody === undefined || req.responseBody === null
              ? ''
              : typeof req.responseBody === 'string'
                ? req.responseBody
                : JSON.stringify(req.responseBody),
        },
        redirectURL: '',
        headersSize: -1,
        bodySize: -1,
      },
      cache: {},
      timings: {
        send: 0,
        wait: typeof req.duration === 'number' && Number.isFinite(req.duration) ? req.duration : 0,
        receive: 0,
      },
    };
  });

  return {
    log: {
      version: '1.2',
      creator: {
        name: 'Screenshot Debug Extension',
        version: '1.0',
      },
      pages: [
        {
          startedDateTime: new Date().toISOString(),
          id: 'page_1',
          title: url || 'unknown',
          pageTimings: {
            onContentLoad: -1,
            onLoad: -1,
          },
        },
      ],
      entries,
    },
  };
};
