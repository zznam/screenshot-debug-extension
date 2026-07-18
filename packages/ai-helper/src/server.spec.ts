import type { AddressInfo } from 'node:net';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createHelperServer } from './server';

const origin = 'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
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
    const response = await fetch(`${url}/health`, { headers: { origin } });
    expect(await response.json()).toEqual({ status: 'ok', keyConfigured: true, model: 'gpt-5.6-terra' });
    expect(response.headers.get('access-control-allow-origin')).toBe(origin);
  });

  it('rejects websites and invalid pairing tokens', async () => {
    const { url } = await startServer();
    const website = await fetch(`${url}/health`, { headers: { origin: 'https://example.com' } });
    expect(website.status).toBe(403);

    const unauthorized = await fetch(`${url}/v1/debug/responses`, {
      method: 'POST',
      headers: { origin, authorization: 'Bearer wrong', 'content-type': 'application/json' },
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
      headers: { origin, authorization: 'Bearer pair-token', 'content-type': 'application/json' },
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
      headers: { origin, authorization: 'Bearer pair-token', 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId: 'session', messages: [] }),
    });
    expect(response.status).toBe(503);
    expect(createResponse).not.toHaveBeenCalled();
  });
});
