import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AiDebugSession } from '@extension/shared';

const session: AiDebugSession = {
  id: 'session',
  createdAt: 1,
  updatedAt: 1,
  status: 'ready',
  model: 'test',
  messages: [],
  context: {
    sourceId: 'source',
    sourceTabId: 1,
    sourceTitle: 'Example',
    sourceUrl: 'https://example.com',
    capturedAt: 1,
    screenshotDataUrl: null,
    records: [],
    recordsTruncated: false,
  },
};

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('indexedDB', new IDBFactory());
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('AI session transaction durability', () => {
  it('reports committed writes and deletions', async () => {
    const storage = await import('./ai-debug-indexed-db.service');
    await storage.putAiDebugSession(session);
    expect(await storage.getAiDebugSession(session.id)).toEqual(session);
    await storage.deleteAiDebugSession(session.id);
    expect(await storage.getAiDebugSession(session.id)).toBeNull();
  });
  it('rejects a save if the transaction aborts after the write request succeeds', async () => {
    const storage = await import('./ai-debug-indexed-db.service');
    const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, ...args) {
      const request = put.apply(this, args);
      request.addEventListener('success', () => this.transaction.abort());
      return request;
    });
    await expect(storage.putAiDebugSession(session)).rejects.toThrow('not updated');
    expect(await storage.getAiDebugSession(session.id)).toBeNull();
  });
  it('rejects an aborted deletion and preserves the saved session', async () => {
    const storage = await import('./ai-debug-indexed-db.service');
    await storage.putAiDebugSession(session);
    const remove = IDBObjectStore.prototype.delete;
    vi.spyOn(IDBObjectStore.prototype, 'delete').mockImplementation(function (this: IDBObjectStore, ...args) {
      const request = remove.apply(this, args);
      request.addEventListener('success', () => this.transaction.abort());
      return request;
    });
    await expect(storage.deleteAiDebugSession(session.id)).rejects.toThrow('not updated');
    expect(await storage.getAiDebugSession(session.id)).toEqual(session);
  });
});
