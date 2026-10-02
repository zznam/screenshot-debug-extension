import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AiDebugSession } from '@extension/shared';

import {
  checkHelper,
  HELPER_URL,
  HELPER_URL_KEY,
  PAIRING_TOKEN_KEY,
  readPairingToken,
  requestAiResponse,
  savePairingToken,
} from './helper-client';

const stored: Record<string, unknown> = {};
const fetchMock = vi.fn();
const set = vi.fn(async (values: Record<string, unknown>) => {
  Object.assign(stored, values);
});
const session: AiDebugSession = {
  id: 'session',
  createdAt: 1,
  updatedAt: 1,
  model: 'test-model',
  status: 'prepared',
  messages: [],
  context: {
    sourceId: 'source',
    sourceTabId: 1,
    sourceUrl: 'https://example.com',
    sourceTitle: 'Example',
    capturedAt: 1,
    screenshotDataUrl: null,
    records: [],
    recordsTruncated: false,
  },
};

beforeEach(() => {
  vi.resetAllMocks();
  for (const key of Object.keys(stored)) delete stored[key];
  set.mockImplementation(async values => {
    Object.assign(stored, values);
  });
  vi.stubGlobal('chrome', {
    runtime: { id: 'extension-id' },
    storage: { local: { get: async () => ({ ...stored }), set } },
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('AI helper browser client', () => {
  it.each([
    ['https://remote.example', HELPER_URL],
    ['http://127.0.0.1.evil.example', HELPER_URL],
    ['not a URL', HELPER_URL],
    ['http://127.0.0.1:43124/path', 'http://127.0.0.1:43124'],
    ['http://localhost:43124/path', 'http://localhost:43124'],
  ])('constrains helper URL %s to loopback', async (candidate, expected) => {
    stored[HELPER_URL_KEY] = candidate;
    fetchMock.mockResolvedValue(Response.json({ keyConfigured: true }));
    await checkHelper();
    expect(fetchMock).toHaveBeenCalledWith(
      `${expected}/health`,
      expect.objectContaining({ signal: expect.any(AbortSignal), redirect: 'error' }),
    );
  });

  it('distinguishes offline, missing API key, pairing, and readiness', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    expect(await checkHelper()).toEqual({ state: 'offline' });
    fetchMock.mockResolvedValueOnce(new Response('', { status: 503 }));
    expect(await checkHelper()).toEqual({ state: 'offline' });
    fetchMock.mockResolvedValueOnce(Response.json({ keyConfigured: false, model: 'model' }));
    expect(await checkHelper()).toEqual({ state: 'missing-key', model: 'model' });
    fetchMock.mockResolvedValueOnce(Response.json({ keyConfigured: true, model: 'model' }));
    expect(await checkHelper()).toEqual({ state: 'unpaired', model: 'model' });
    await savePairingToken(' token \n');
    expect(await readPairingToken()).toBe('token');
    fetchMock.mockResolvedValueOnce(Response.json({ keyConfigured: true, model: 'model' }));
    expect(await checkHelper()).toEqual({ state: 'ready', model: 'model' });
  });

  it('sends paired context only to the helper with a timeout and no redirects', async () => {
    stored[PAIRING_TOKEN_KEY] = 'pair-token';
    const result = {
      status: 'success',
      message: { id: 'm', role: 'assistant', content: 'answer', createdAt: 1 },
      model: 'test',
    };
    fetchMock.mockResolvedValue(Response.json(result));
    expect(await requestAiResponse(session)).toEqual(result);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(`${HELPER_URL}/v1/debug/responses`);
    expect(options).toMatchObject({
      method: 'POST',
      redirect: 'error',
      headers: { authorization: 'Bearer pair-token', 'x-screenshot-debug-extension-id': 'extension-id' },
    });
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(options.body)).toEqual({ sessionId: session.id, messages: [], context: session.context });
  });

  it('reports helper errors and HTTP failures', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ status: 'error', message: 'Pair again' }, { status: 401 }));
    await expect(requestAiResponse(session)).rejects.toThrow('Pair again');
    fetchMock.mockResolvedValueOnce(Response.json({ status: 'error' }));
    await expect(requestAiResponse(session)).rejects.toThrow('The AI helper request failed.');
    fetchMock.mockResolvedValueOnce(Response.json({}, { status: 502 }));
    await expect(requestAiResponse(session)).rejects.toThrow('The AI helper request failed.');
  });
});
