import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('indexedDB', new IDBFactory());
  vi.stubGlobal('IDBKeyRange', IDBKeyRange);
});
afterEach(() => vi.unstubAllGlobals());
const row = (tabId: number, timestamp: number, sequence = 0) => ({
  tabId,
  timestamp,
  sequence,
  kind: 'rrweb' as const,
  payload: { timestamp, sequence },
});

describe('persisted Rewind event buffers', () => {
  it('preserves same-timestamp events using sequence numbers and isolates tabs', async () => {
    const db = await import('./rewind-indexed-db.service');
    await db.putBatch([row(1, 10, 1), row(1, 10, 0), row(1, 20), row(2, 10)]);
    expect(await db.getRange(1, 10, 20)).toEqual([row(1, 10, 0), row(1, 10, 1), row(1, 20)]);
    expect(await db.getRange(2, 10, 20)).toEqual([row(2, 10)]);
  });

  it('evicts only events strictly before the cutoff in the requested tab', async () => {
    const db = await import('./rewind-indexed-db.service');
    await db.putBatch([row(1, 9), row(1, 10), row(1, 11), row(2, 9)]);
    await db.deleteBefore(1, 10);
    expect(await db.getRange(1, 0, 100)).toEqual([row(1, 10), row(1, 11)]);
    expect(await db.getRange(2, 0, 100)).toEqual([row(2, 9)]);
  });

  it('deletes an entire tab while retaining other tabs', async () => {
    const db = await import('./rewind-indexed-db.service');
    await db.putBatch([]);
    await db.putBatch([row(1, 1), row(1, 2), row(2, 1)]);
    await db.deleteTabAll(1);
    expect(await db.getRange(1, 0, 100)).toEqual([]);
    expect(await db.getRange(2, 0, 100)).toEqual([row(2, 1)]);
  });
});
