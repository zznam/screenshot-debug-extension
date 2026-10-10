import { IDBFactory, IDBKeyRange, IDBObjectStore } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LibrarySession } from './database.js';
import type * as LibraryModule from './database.js';
import type { ScreenshotSavePayload } from './types.js';

let library: typeof LibraryModule;
const png =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jD1sAAAAASUVORK5CYII=';
const session: LibrarySession = {
  id: 'session',
  captureId: 'capture',
  owner: '7:document',
  createdAt: Date.now(),
  source: { url: 'https://example.com/source', title: 'Checkout', domain: 'example.com', capturedAt: 100 },
  diagnostics: [{ message: 'Captured before save' }],
};
const payload = (): ScreenshotSavePayload => ({
  id: 'capture',
  snapshotId: 'session',
  expectedRevision: 0,
  title: 'Checkout issue',
  screenshots: [
    {
      id: 'shot',
      original: png,
      preview: png,
      thumbnail: png,
      isPrimary: true,
      annotations: { objects: [{ type: 'Rect', fill: '#f00' }] },
    },
  ],
});

describe('durable local library', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal('indexedDB', new IDBFactory());
    vi.stubGlobal('IDBKeyRange', IDBKeyRange);
    library = await import('./database.js');
    await library.saveLibrarySession(session);
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    (await library.openLibrary()).close();
    vi.unstubAllGlobals();
  });

  it('persists original, flattened preview, layers and frozen source diagnostics together', async () => {
    expect(await library.commitScreenshotCapture(payload(), session)).toBe(1);
    const capture = await library.getLibraryCapture('capture');
    expect(capture).toMatchObject({
      schemaVersion: 1,
      revision: 1,
      diagnostics: session.diagnostics,
      source: session.source,
    });
    expect(capture).not.toHaveProperty('owner');
    expect(capture!.screenshots[0]!.annotations.objects).toEqual([{ type: 'Rect', fill: '#f00' }]);
    const asset = await library.getLibraryAsset(capture!.screenshots[0]!.originalAssetId);
    expect(asset?.type).toBe('image/png');
    expect(asset?.size).toBeGreaterThan(0);
    expect(await library.listLibraryCaptures()).toEqual([
      expect.objectContaining({ screenshotCount: 1, diagnosticCount: 1 }),
    ]);
  });

  it('keeps partial uploads invisible and enforces ownership and chunk ordering', async () => {
    const id = await library.beginLibraryUpload(session.id, session.owner);
    await expect(library.appendLibraryChunk(id, 'other', 0, 'secret')).rejects.toThrow();
    await expect(library.appendLibraryChunk(id, session.owner, 1, 'out of order')).rejects.toThrow();
    await library.appendLibraryChunk(id, session.owner, 0, '{"partial":');
    expect(await library.listLibraryCaptures()).toEqual([]);
    await expect(library.readLibraryUpload(id, 'other')).rejects.toThrow();
    expect((await library.readLibraryUpload(id, session.owner)).text).toBe('{"partial":');
    await library.discardLibraryUpload(id, 'other');
    expect((await library.readLibraryUpload(id, session.owner)).text).toBe('{"partial":');
    await library.discardLibraryUpload(id, session.owner);
    await expect(library.readLibraryUpload(id, session.owner)).rejects.toThrow();
  });

  it('preserves the last committed capture when a revision conflicts', async () => {
    await library.commitScreenshotCapture(payload(), session);
    const original = await library.getLibraryCapture('capture');
    await expect(library.commitScreenshotCapture({ ...payload(), title: 'stale' }, session)).rejects.toThrow('changed');
    expect(await library.getLibraryCapture('capture')).toEqual(original);
    expect(await library.getLibraryAsset(original!.screenshots[0]!.originalAssetId)).toBeDefined();
  });

  it('rolls back an asset-write failure without deleting the previously saved evidence', async () => {
    await library.commitScreenshotCapture(payload(), session);
    const original = await library.getLibraryCapture('capture');
    const put = IDBObjectStore.prototype.put;
    const failing = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
      this: IDBObjectStore,
      value,
      key,
    ) {
      if (this.name === 'assets') throw new DOMException('Storage is full', 'QuotaExceededError');
      return put.call(this, value, key);
    });
    await expect(library.commitScreenshotCapture({ ...payload(), expectedRevision: 1 }, session)).rejects.toMatchObject(
      { name: 'QuotaExceededError' },
    );
    failing.mockRestore();
    expect(await library.getLibraryCapture('capture')).toEqual(original);
    expect(await library.getLibraryAsset(original!.screenshots[0]!.originalAssetId)).toBeDefined();
  });

  it('atomically replaces the old asset set on a subsequent save', async () => {
    await library.commitScreenshotCapture(payload(), session);
    const original = await library.getLibraryCapture('capture');
    await library.commitScreenshotCapture({ ...payload(), expectedRevision: 1, title: 'Updated' }, session);
    const current = await library.getLibraryCapture('capture');
    expect(current!.title).toBe('Updated');
    expect(current!.revision).toBe(2);
    expect(await library.getLibraryAsset(original!.screenshots[0]!.originalAssetId)).toBeUndefined();
    expect(await library.getLibraryAsset(current!.screenshots[0]!.originalAssetId)).toBeDefined();
  });

  it('rejects malformed images, duplicate screenshot IDs and foreign capture IDs without writing', async () => {
    const bad = payload();
    bad.screenshots[0]!.original = 'https://remote.example/private.png';
    await expect(library.commitScreenshotCapture(bad, session)).rejects.toThrow('PNG or JPEG');
    await expect(library.commitScreenshotCapture({ ...payload(), id: 'someone-else' }, session)).rejects.toThrow();
    const duplicates = payload();
    duplicates.screenshots.push(duplicates.screenshots[0]!);
    await expect(library.commitScreenshotCapture(duplicates, session)).rejects.toThrow();
    expect(await library.listLibraryCaptures()).toEqual([]);
  });

  it('protects metadata from stale overwrites, normalizes tags, and removes every asset on deletion', async () => {
    await library.commitScreenshotCapture(payload(), session);
    const capture = await library.getLibraryCapture('capture');
    await library.updateLibraryMetadata('capture', 1, ' Renamed ', [' checkout ', 'checkout', '']);
    expect(await library.getLibraryCapture('capture')).toMatchObject({
      title: 'Renamed',
      tags: ['checkout'],
      revision: 2,
    });
    await expect(library.updateLibraryMetadata('capture', 1, 'Stale', [])).rejects.toThrow('changed');
    await library.deleteLibraryCapture('capture');
    expect(await library.listLibraryCaptures()).toEqual([]);
    expect(await library.getLibraryAsset(capture!.screenshots[0]!.originalAssetId)).toBeUndefined();
    expect(await library.getLibraryAsset(capture!.screenshots[0]!.previewAssetId)).toBeUndefined();
  });

  it('cleans expired staging without expiring saved captures', async () => {
    const old = { ...session, createdAt: Date.now() - 48 * 60 * 60 * 1000 };
    await library.saveLibrarySession(old);
    await library.commitScreenshotCapture(payload(), old);
    await library.cleanLibraryStaging();
    expect(await library.getLibrarySession(session.id)).toBeUndefined();
    expect(await library.getLibraryCapture('capture')).toBeDefined();
    await expect(library.beginLibraryUpload(session.id, session.owner)).rejects.toThrow('expired');
  });

  it('calculates library storage statistics across saved captures and assets', async () => {
    const initialStats = await library.getLibraryStorageStats();
    expect(initialStats).toEqual({ totalBytes: 0, captureCount: 0, assetCount: 0 });

    await library.commitScreenshotCapture(payload(), session);
    const stats = await library.getLibraryStorageStats();
    expect(stats.captureCount).toBe(1);
    expect(stats.assetCount).toBe(2);
    expect(stats.totalBytes).toBeGreaterThan(0);
  });

  it('supports bulk deletion of multiple captures and their associated assets', async () => {
    await library.commitScreenshotCapture(payload(), session);

    const session2: LibrarySession = {
      ...session,
      id: 'session-2',
      captureId: 'capture-2',
    };
    await library.saveLibrarySession(session2);
    await library.commitScreenshotCapture({ ...payload(), id: 'capture-2', snapshotId: 'session-2' }, session2);

    expect(await library.listLibraryCaptures()).toHaveLength(2);

    await library.deleteLibraryCaptures(['capture', 'capture-2', 'capture']);
    expect(await library.listLibraryCaptures()).toEqual([]);

    const stats = await library.getLibraryStorageStats();
    expect(stats.captureCount).toBe(0);
    expect(stats.assetCount).toBe(0);
  });
});
