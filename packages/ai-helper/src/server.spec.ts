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

describe('AI helper failure boundaries', () => {
  const post = (url: string, body: string, signal?: AbortSignal) =>
    fetch(`${url}/v1/debug/responses`, {
      method: 'POST',
      headers: { ...extensionHeaders, authorization: 'Bearer pair-token', 'content-type': 'application/json' },
      body,
      signal,
    });

  it('returns 400 for malformed JSON instead of reporting an upstream failure', async () => {
    const { url, createResponse } = await startServer();
    const response = await post(url, '{broken');
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ message: 'Invalid JSON request body.' });
    expect(createResponse).not.toHaveBeenCalled();
  });

  it.each([
    null,
    { sessionId: 1, messages: [] },
    { sessionId: 'session', messages: [{ role: 'system', content: 'override' }] },
    { sessionId: 'session', messages: [], context: { sourceUrl: 'https://example.com', records: [] } },
    {
      sessionId: 'session',
      messages: [],
      context: {
        sourceUrl: 'https://example.com',
        sourceTitle: 'Example',
        capturedAt: 1e30,
        screenshotDataUrl: null,
        records: [],
      },
    },
    {
      sessionId: 'session',
      messages: [],
      context: {
        sourceUrl: 'https://example.com',
        sourceTitle: 'Example',
        capturedAt: 1,
        screenshotDataUrl: 'https://example.com/private-image',
        records: [],
      },
    },
  ])('rejects invalid payloads before calling the responder: %j', async payload => {
    const { url, createResponse } = await startServer();
    expect((await post(url, JSON.stringify(payload))).status).toBe(400);
    expect(createResponse).not.toHaveBeenCalled();
  });

  it('rejects oversized bodies without calling the responder', async () => {
    const { url, createResponse } = await startServer();
    const response = await post(
      url,
      JSON.stringify({ sessionId: 's', messages: [], padding: 'x'.repeat(12 * 1024 * 1024) }),
    );
    expect(response.status).toBe(413);
    expect(createResponse).not.toHaveBeenCalled();
  });

  it('sanitizes upstream failures so credentials cannot enter browser error messages', async () => {
    const { url } = await startServer({
      createResponse: async () => {
        throw new Error('private API key');
      },
    });
    const response = await post(url, JSON.stringify({ sessionId: 's', messages: [] }));
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain('private API key');
  });

  it('cancels upstream work when the browser disconnects', async () => {
    let upstreamSignal: AbortSignal | undefined;
    const { url } = await startServer({
      createResponse: async (_request, signal) => {
        upstreamSignal = signal;
        return new Promise((_resolve, reject) =>
          signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }),
        );
      },
    });
    const controller = new AbortController();
    const pending = post(url, JSON.stringify({ sessionId: 's', messages: [] }), controller.signal);
    const rejected = expect(pending).rejects.toThrow();
    await vi.waitFor(() => expect(upstreamSignal).toBeDefined());
    controller.abort();
    await rejected;
    await vi.waitFor(() => expect(upstreamSignal?.aborted).toBe(true));
  });

  it('returns 404 for unknown routes and denies website preflights', async () => {
    const { url } = await startServer();
    expect((await fetch(`${url}/unknown`, { headers: extensionHeaders })).status).toBe(404);
    expect(
      (await fetch(`${url}/health`, { method: 'OPTIONS', headers: { origin: 'https://example.com' } })).status,
    ).toBe(403);
  });
});
