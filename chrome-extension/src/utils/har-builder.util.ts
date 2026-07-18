import type { Record as ExtRecord } from '@src/types';

export const buildHarLog = (records: ExtRecord[], url: string) => {
  const networkRequests = records.filter(r => r.recordType === 'network');

  const entries = networkRequests.map(req => {
    // Basic mapping of our simplified Record to HAR 1.2 entry format
    return {
      startedDateTime: req.timestamp ? new Date(req.timestamp).toISOString() : new Date().toISOString(),
      time: req.duration || -1,
      request: {
        method: req.method || 'GET',
        url: req.url,
        httpVersion: 'HTTP/1.1',
        cookies: [],
        headers: [],
        queryString: [],
        postData: req.requestBody
          ? {
              mimeType: 'application/json',
              text: JSON.stringify(req.requestBody.parsed || {}),
            }
          : undefined,
        headersSize: -1,
        bodySize: req.requestBody ? JSON.stringify(req.requestBody).length : -1,
      },
      response: {
        status: req.status || 200,
        statusText: 'OK',
        httpVersion: 'HTTP/1.1',
        cookies: [],
        headers: [],
        content: {
          size: req.responseBody ? JSON.stringify(req.responseBody).length : -1,
          mimeType: 'application/json',
          text: typeof req.responseBody === 'string' ? req.responseBody : JSON.stringify(req.responseBody || {}),
        },
        redirectURL: '',
        headersSize: -1,
        bodySize: -1,
      },
      cache: {},
      timings: {
        send: 0,
        wait: req.duration || 0,
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
          title: url,
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
