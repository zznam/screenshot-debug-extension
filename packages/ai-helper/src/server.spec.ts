import type { AddressInfo } from 'node:net';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createHelperServer, EXTENSION_ID_HEADER } from './server';

const origin = 'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const extensionId = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const extensionHeaders = { origin, [EXTENSION_ID_HEADER]: extensionId };
const servers: ReturnType<typeof createHelperServer>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))));
});

const startServer = async (overrides: Partial<Parameters<typeof createHelperServer>[0]> = {}) => {
  const createResponse = vi.fn(async () => ({ text: 'Likely root cause', model: 'gpt-5.6-terra' }));
  const server = createHelperServer({
    apiKey: 'test-key',
    model: 'gpt-5.6-terra',
    pairingToken: 'pair-token',
    createResponse,
    ...overrides,
  });
  servers.push(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  return { url: `http://127.0.0.1:${port}`, createResponse };
};

describe('AI helper server', () => {
  it('reports helper readiness without exposing the API key', async () => {
    const { url } = await startServer();
    const response = await fetch(`${url}/health`, { headers: extensionHeaders });
    expect(await response.json()).toEqual({ status: 'ok', keyConfigured: true, model: 'gpt-5.6-terra' });
    expect(response.headers.get('access-control-allow-origin')).toBe(origin);
  });

  it('accepts parsed extension origins without relying on one exact serialization', async () => {
    const { url } = await startServer();
    const unpackedOrigin = 'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/';
    const response = await fetch(`${url}/health`, {
      headers: { origin: unpackedOrigin, [EXTENSION_ID_HEADER]: `${extensionId}a` },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe(unpackedOrigin);
  });

  it('accepts Chromium opaque extension origins only with a valid extension ID handshake', async () => {
    const { url } = await startServer();
    const response = await fetch(`${url}/health`, {
      headers: { origin: 'null', [EXTENSION_ID_HEADER]: extensionId },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('null');

    const missingHandshake = await fetch(`${url}/health`, { headers: { origin: 'null' } });
    expect(missingHandshake.status).toBe(403);
  });

  it('accepts extension fetches that Chromium sends without an Origin header', async () => {
    const { url } = await startServer();
    const response = await fetch(`${url}/health`, {
      headers: { [EXTENSION_ID_HEADER]: extensionId },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('allows browser preflight before the extension ID header is sent', async () => {
    const { url } = await startServer();
    const response = await fetch(`${url}/health`, {
      method: 'OPTIONS',
      headers: {
        origin: 'null',
        'access-control-request-method': 'GET',
        'access-control-request-headers': EXTENSION_ID_HEADER,
      },
    });
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('null');
    expect(response.headers.get('access-control-allow-headers')).toContain(EXTENSION_ID_HEADER);
  });

  it('rejects websites and invalid pairing tokens', async () => {
    const { url } = await startServer();
    const website = await fetch(`${url}/health`, {
      headers: { origin: 'https://example.com', [EXTENSION_ID_HEADER]: extensionId },
    });
    expect(website.status).toBe(403);

    const mismatchedExtension = await fetch(`${url}/health`, {
      headers: { origin, [EXTENSION_ID_HEADER]: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
    });
    expect(mismatchedExtension.status).toBe(403);

    const unauthorized = await fetch(`${url}/v1/debug/responses`, {
      method: 'POST',
      headers: { ...extensionHeaders, authorization: 'Bearer wrong', 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId: 'session', messages: [] }),
    });
    expect(unauthorized.status).toBe(401);
  });

  it('passes validated context to the responder and returns a typed message', async () => {
    const { url, createResponse } = await startServer();
    const request = {
      sessionId: 'session',
      messages: [{ id: 'm1', role: 'user', content: 'debug this', createdAt: 1 }],
      context: {
        sourceTabId: 1,
        sourceId: 'source',
        sourceUrl: 'https://example.com',
        sourceTitle: 'Example',
        capturedAt: 1,
        screenshotDataUrl: 'data:image/jpeg;base64,AA==',
        records: [],
        recordsTruncated: false,
      },
    };
    const response = await fetch(`${url}/v1/debug/responses`, {
      method: 'POST',
      headers: { ...extensionHeaders, authorization: 'Bearer pair-token', 'content-type': 'application/json' },
      body: JSON.stringify(request),
    });
    const body = (await response.json()) as { status: string; message: { role: string; content: string } };
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ status: 'success', message: { role: 'assistant', content: 'Likely root cause' } });
    expect(createResponse).toHaveBeenCalledWith(request, expect.any(AbortSignal));
  });

  it('keeps requests local when OPENAI_API_KEY is missing', async () => {
    const { url, createResponse } = await startServer({ apiKey: undefined });
    const response = await fetch(`${url}/v1/debug/responses`, {
      method: 'POST',
      headers: { ...extensionHeaders, authorization: 'Bearer pair-token', 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId: 'session', messages: [] }),
    });
    expect(response.status).toBe(503);
    expect(createResponse).not.toHaveBeenCalled();
  });
});
