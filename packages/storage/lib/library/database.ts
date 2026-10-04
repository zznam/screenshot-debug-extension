import type {
  CaptureDocument,
  CaptureSnapshot,
  CaptureSummary,
  ScreenshotSavePayload,
  ScreenshotEditPayload,
} from './types.js';

interface StoredCapture extends CaptureDocument {
  thumbnail: string;
  owner: string;
}
interface CaptureAsset {
  id: string;
  captureId: string;
  blob: Blob;
}
interface LibrarySession extends CaptureSnapshot {
  owner: string;
  createdAt: number;
}
interface Upload {
  id: string;
  owner: string;
  snapshotId: string;
  nextIndex: number;
  length: number;
  createdAt: number;
}

const DATABASE = 'screenshot_debug_library_v1';
const CHUNK_SIZE = 256 * 1024;
const MAX_UPLOAD_SIZE = 128 * 1024 * 1024;
const STAGING_TTL = 24 * 60 * 60 * 1000;
let databasePromise: Promise<IDBDatabase> | null = null;

const openLibrary = (): Promise<IDBDatabase> => {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore('captures', { keyPath: 'id' });
      db.createObjectStore('assets', { keyPath: 'id' }).createIndex('captureId', 'captureId');
      db.createObjectStore('sessions', { keyPath: 'id' });
      db.createObjectStore('uploads', { keyPath: 'id' });
      db.createObjectStore('chunks', { keyPath: ['uploadId', 'index'] }).createIndex('uploadId', 'uploadId');
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => {
        request.result.close();
        databasePromise = null;
      };
      resolve(request.result);
    };
    request.onerror = () => {
      databasePromise = null;
      reject(request.error);
    };
    request.onblocked = () => {
      databasePromise = null;
      reject(new Error('Close other library tabs and try again.'));
    };
  });
  return databasePromise;
};

const result = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const completed = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Library write failed.'));
    tx.onabort = () => reject(tx.error ?? new Error('Library write was cancelled.'));
  });

const readOne = async <T>(store: string, id: string): Promise<T | undefined> => {
  const db = await openLibrary();
  return result(db.transaction(store).objectStore(store).get(id)) as Promise<T | undefined>;
};

const writeOne = async (store: string, value: unknown) => {
  const db = await openLibrary();
  const tx = db.transaction(store, 'readwrite');
  const done = completed(tx);
  tx.objectStore(store).put(value);
  await done;
};

const notifyChange = () => {
  // BroadcastChannel reaches extension pages without disclosing data to content scripts.
  if (typeof BroadcastChannel === 'undefined') return;
  const channel = new BroadcastChannel('capture-library');
  channel.postMessage('changed');
  channel.close();
};

const saveLibrarySession = (session: LibrarySession) => writeOne('sessions', session);
const getLibrarySession = (id: string) => readOne<LibrarySession>('sessions', id);

const beginLibraryUpload = async (snapshotId: string, owner: string): Promise<string> => {
  const snapshot = await getLibrarySession(snapshotId);
  if (!snapshot || snapshot.owner !== owner)
    throw new Error('Capture context expired. Download this preview, then start a new capture.');
  const id = crypto.randomUUID();
  await writeOne('uploads', { id, owner, snapshotId, nextIndex: 0, length: 0, createdAt: Date.now() } satisfies Upload);
  return id;
};

const appendLibraryChunk = async (id: string, owner: string, index: number, text: string) => {
  if (!Number.isInteger(index) || index < 0 || typeof text !== 'string' || text.length > CHUNK_SIZE)
    throw new Error('Invalid capture chunk.');
  const db = await openLibrary();
  const tx = db.transaction(['uploads', 'chunks'], 'readwrite');
  const done = completed(tx);
  const request = tx.objectStore('uploads').get(id);
  let failure: Error | undefined;
  request.onsuccess = () => {
    const upload = request.result as Upload | undefined;
    if (
      !upload ||
      upload.owner !== owner ||
      upload.nextIndex !== index ||
      upload.length + text.length > MAX_UPLOAD_SIZE
    ) {
      failure = new Error('Capture upload is missing, out of order, or too large.');
      tx.abort();
      return;
    }
    tx.objectStore('chunks').put({ uploadId: id, index, text });
    tx.objectStore('uploads').put({ ...upload, nextIndex: index + 1, length: upload.length + text.length });
  };
  await done.catch(error => {
    throw failure ?? error;
  });
};

const deleteByIndex = (store: IDBObjectStore, index: string, key: string) => {
  const request = store.index(index).openCursor(IDBKeyRange.only(key));
  request.onsuccess = () => {
    const cursor = request.result;
    if (cursor) {
      cursor.delete();
      cursor.continue();
    }
  };
};

const discardLibraryUpload = async (id: string, owner: string) => {
  const upload = await readOne<Upload>('uploads', id);
  if (!upload || upload.owner !== owner) return;
  const db = await openLibrary();
  const tx = db.transaction(['uploads', 'chunks'], 'readwrite');
  const done = completed(tx);
  tx.objectStore('uploads').delete(id);
  deleteByIndex(tx.objectStore('chunks'), 'uploadId', id);
  await done;
};

const readLibraryUpload = async (id: string, owner: string) => {
  const upload = await readOne<Upload>('uploads', id);
  if (!upload || upload.owner !== owner) throw new Error('Capture upload no longer exists.');
  const db = await openLibrary();
  const chunks = (await result(db.transaction('chunks').objectStore('chunks').index('uploadId').getAll(id))) as {
    index: number;
    text: string;
  }[];
  chunks.sort((a, b) => a.index - b.index);
  if (chunks.length !== upload.nextIndex || chunks.some((chunk, index) => chunk.index !== index))
    throw new Error('Capture upload is incomplete.');
  return { text: chunks.map(chunk => chunk.text).join(''), snapshotId: upload.snapshotId };
};

const imageBlob = (data: string): Blob => {
  const match = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/=]+)$/.exec(data);
  if (!match) throw new Error('Captures must contain PNG or JPEG images.');
  const bytes = Uint8Array.from(atob(match[2]!), character => character.charCodeAt(0));
  return new Blob([bytes], { type: match[1] });
};

const commitScreenshotCapture = async (payload: ScreenshotSavePayload, session: LibrarySession) => {
  if (
    payload.id !== session.captureId ||
    payload.snapshotId !== session.id ||
    !Number.isInteger(payload.expectedRevision) ||
    payload.expectedRevision < 0 ||
    typeof payload.title !== 'string' ||
    payload.title.length > 500 ||
    !Array.isArray(payload.screenshots) ||
    !payload.screenshots.length ||
    payload.screenshots.length > 30
  )
    throw new Error('Invalid capture document.');
  const assets: CaptureAsset[] = [];
  const ids = new Set<string>();
  const screenshots = payload.screenshots.map(shot => {
    if (
      !shot ||
      typeof shot.id !== 'string' ||
      !shot.id ||
      ids.has(shot.id) ||
      !Array.isArray(shot.annotations?.objects)
    )
      throw new Error('Invalid screenshot annotations.');
    ids.add(shot.id);
    const originalAssetId = crypto.randomUUID();
    const previewAssetId = crypto.randomUUID();
    assets.push(
      { id: originalAssetId, captureId: payload.id, blob: imageBlob(shot.original) },
      { id: previewAssetId, captureId: payload.id, blob: imageBlob(shot.preview) },
    );
    return {
      id: shot.id,
      originalAssetId,
      previewAssetId,
      annotations: shot.annotations,
      isPrimary: shot.isPrimary === true,
    };
  });
  const thumbnail = payload.screenshots[0]!.thumbnail;
  if (thumbnail.length > 200_000) throw new Error('Capture thumbnail is too large.');
  imageBlob(thumbnail);
  const sizeBytes =
    assets.reduce((size, asset) => size + asset.blob.size, 0) +
    new TextEncoder().encode(JSON.stringify({ screenshots, diagnostics: session.diagnostics, thumbnail })).byteLength;
  const db = await openLibrary();
  const tx = db.transaction(['captures', 'assets'], 'readwrite');
  const done = completed(tx);
  let failure: Error | undefined;
  let saved: StoredCapture;
  const existing = tx.objectStore('captures').get(payload.id);
  existing.onsuccess = () => {
    const previous = existing.result as StoredCapture | undefined;
    if ((previous?.revision ?? 0) !== payload.expectedRevision || (previous && previous.owner !== session.id)) {
      failure = new Error('This capture changed in another window. Reopen it before saving again.');
      tx.abort();
      return;
    }
    saved = {
      schemaVersion: 1,
      id: payload.id,
      revision: (previous?.revision ?? 0) + 1,
      kind: 'screenshots',
      title: payload.title.trim() || session.source.title || 'Untitled capture',
      tags: previous?.tags ?? [],
      source: session.source,
      createdAt: previous?.createdAt ?? session.source.capturedAt,
      updatedAt: Date.now(),
      screenshots,
      diagnostics: session.diagnostics,
      sizeBytes,
      thumbnail,
      owner: session.id,
    };
    // Delete only prior asset IDs; a cursor must never sweep newly inserted assets.
    try {
      previous?.screenshots.forEach(shot => {
        tx.objectStore('assets').delete(shot.originalAssetId);
        tx.objectStore('assets').delete(shot.previewAssetId);
      });
      assets.forEach(asset => tx.objectStore('assets').put(asset));
      tx.objectStore('captures').put(saved);
    } catch (cause) {
      failure = cause instanceof Error ? cause : new Error('Could not store capture assets.');
      tx.abort();
    }
  };
  await done.catch(error => {
    throw failure ?? error;
  });
  notifyChange();
  return saved!.revision;
};

const getLibraryCapture = async (id: string): Promise<CaptureDocument | undefined> => {
  const stored = await readOne<StoredCapture>('captures', id);
  if (!stored) return undefined;
  const { owner: _owner, thumbnail: _thumbnail, ...document } = stored;
  return document;
};
const getLibraryAsset = async (id: string) => (await readOne<CaptureAsset>('assets', id))?.blob;

const updateLibraryScreenshots = async (payload: ScreenshotEditPayload): Promise<number> => {
  if (
    !payload.title?.trim() ||
    payload.title.length > 500 ||
    !Number.isInteger(payload.expectedRevision) ||
    payload.expectedRevision < 1 ||
    !Array.isArray(payload.screenshots) ||
    !payload.screenshots.length ||
    payload.screenshots.length > 30
  )
    throw new Error('Invalid screenshot edits.');
  if (typeof payload.thumbnail !== 'string' || payload.thumbnail.length > 200_000)
    throw new Error('Capture thumbnail is too large.');
  imageBlob(payload.thumbnail);
  const ids = new Set<string>();
  const edits = payload.screenshots.map(shot => {
    if (!shot?.id || ids.has(shot.id) || !Array.isArray(shot.annotations?.objects))
      throw new Error('Invalid screenshot annotations.');
    ids.add(shot.id);
    return {
      ...shot,
      annotations: structuredClone(shot.annotations),
      blob: imageBlob(shot.preview),
      assetId: crypto.randomUUID(),
    };
  });
  const db = await openLibrary();
  const tx = db.transaction(['captures', 'assets'], 'readwrite');
  const done = completed(tx);
  let failure: Error | undefined;
  const request = tx.objectStore('captures').get(payload.id);
  request.onsuccess = () => {
    const previous = request.result as StoredCapture | undefined;
    if (!previous) {
      failure = new Error('This capture was deleted. Download your edits before leaving.');
      tx.abort();
      return;
    }
    if (previous.revision !== payload.expectedRevision) {
      failure = new Error('This capture changed in another window. Download your edits or reload the latest version.');
      tx.abort();
      return;
    }
    if (previous.screenshots.length !== edits.length || previous.screenshots.some(shot => !ids.has(shot.id))) {
      failure = new Error('These edits do not match the saved screenshot set.');
      tx.abort();
      return;
    }
    let remaining = previous.screenshots.length;
    let originalBytes = 0;
    previous.screenshots.forEach(shot => {
      const original = tx.objectStore('assets').get(shot.originalAssetId);
      original.onsuccess = () => {
        const asset = original.result as CaptureAsset | undefined;
        if (!asset || asset.captureId !== previous.id) {
          failure = new Error('An original screenshot is missing. Download your edits before leaving.');
          tx.abort();
          return;
        }
        originalBytes += asset.blob.size;
        remaining -= 1;
        if (remaining) return;
        const screenshots = previous.screenshots.map(saved => {
          const edit = edits.find(item => item.id === saved.id)!;
          return { ...saved, previewAssetId: edit.assetId, annotations: edit.annotations };
        });
        const sizeBytes =
          originalBytes +
          edits.reduce((total, edit) => total + edit.blob.size, 0) +
          new TextEncoder().encode(
            JSON.stringify({ screenshots, diagnostics: previous.diagnostics, thumbnail: payload.thumbnail }),
          ).byteLength;
        try {
          previous.screenshots.forEach(saved => tx.objectStore('assets').delete(saved.previewAssetId));
          edits.forEach(edit =>
            tx
              .objectStore('assets')
              .put({ id: edit.assetId, captureId: previous.id, blob: edit.blob } satisfies CaptureAsset),
          );
          tx.objectStore('captures').put({
            ...previous,
            title: payload.title.trim(),
            screenshots,
            thumbnail: payload.thumbnail,
            sizeBytes,
            revision: previous.revision + 1,
            updatedAt: Date.now(),
          });
        } catch (cause) {
          failure = cause instanceof Error ? cause : new Error('Could not store screenshot edits.');
          tx.abort();
        }
      };
    });
  };
  await done.catch(error => {
    throw failure ?? error;
  });
  notifyChange();
  return payload.expectedRevision + 1;
};
const listLibraryCaptures = async (): Promise<CaptureSummary[]> => {
  const db = await openLibrary();
  const captures = (await result(db.transaction('captures').objectStore('captures').getAll())) as StoredCapture[];
  return captures
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(capture => {
      const { screenshots, diagnostics, owner: _owner, ...summary } = capture;
      return { ...summary, screenshotCount: screenshots.length, diagnosticCount: diagnostics.length };
    });
};
const updateLibraryMetadata = async (id: string, revision: number, title: string, tags: string[]) => {
  if (
    typeof title !== 'string' ||
    !title.trim() ||
    title.length > 500 ||
    !Array.isArray(tags) ||
    tags.length > 20 ||
    tags.some(tag => typeof tag !== 'string' || tag.length > 60)
  )
    throw new Error('Use a title and up to 20 short tags.');
  const db = await openLibrary();
  const tx = db.transaction('captures', 'readwrite');
  const done = completed(tx);
  const request = tx.objectStore('captures').get(id);
  let failure: Error | undefined;
  request.onsuccess = () => {
    const capture = request.result as StoredCapture | undefined;
    if (!capture || capture.revision !== revision) {
      failure = new Error('This capture changed. Refresh the library and try again.');
      tx.abort();
      return;
    }
    tx.objectStore('captures').put({
      ...capture,
      title: title.trim(),
      tags: [...new Set(tags.map(tag => tag.trim()).filter(Boolean))],
      revision: revision + 1,
      updatedAt: Date.now(),
    });
  };
  await done.catch(error => {
    throw failure ?? error;
  });
  notifyChange();
};
const deleteLibraryCapture = async (id: string) => {
  const db = await openLibrary();
  const tx = db.transaction(['captures', 'assets'], 'readwrite');
  const done = completed(tx);
  tx.objectStore('captures').delete(id);
  deleteByIndex(tx.objectStore('assets'), 'captureId', id);
  await done;
  notifyChange();
};
const cleanLibraryStaging = async () => {
  const db = await openLibrary();
  const tx = db.transaction(['sessions', 'uploads', 'chunks'], 'readwrite');
  const done = completed(tx);
  for (const name of ['sessions', 'uploads']) {
    const request = tx.objectStore(name).openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      if (cursor.value.createdAt < Date.now() - STAGING_TTL) {
        if (name === 'uploads') deleteByIndex(tx.objectStore('chunks'), 'uploadId', cursor.value.id);
        cursor.delete();
      }
      cursor.continue();
    };
  }
  await done;
};

export {
  CHUNK_SIZE,
  openLibrary,
  saveLibrarySession,
  getLibrarySession,
  beginLibraryUpload,
  appendLibraryChunk,
  discardLibraryUpload,
  readLibraryUpload,
  commitScreenshotCapture,
  listLibraryCaptures,
  getLibraryCapture,
  getLibraryAsset,
  updateLibraryMetadata,
  updateLibraryScreenshots,
  deleteLibraryCapture,
  cleanLibraryStaging,
};
export type { LibrarySession };
