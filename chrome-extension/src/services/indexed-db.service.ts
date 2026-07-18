import type { Record } from '@src/types';

const DB_NAME = 'screenshot_debug_records_v1';
const DB_VERSION = 1;
const STORE_NAME = 'records';

let dbPromise: Promise<IDBDatabase> | null = null;

const initDB = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = event => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'uuid' });
        store.createIndex('tabId', 'tabId', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = event => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = event => {
      console.error('[IndexedDB] initDB error:', (event.target as IDBOpenDBRequest).error);
      reject((event.target as IDBOpenDBRequest).error);
    };
  });

  return dbPromise;
};

export const putRecordToDB = async (tabId: number, record: Record & { uuid: string }): Promise<void> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const request = store.put({ ...record, tabId });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[IndexedDB] putRecordToDB error:', error);
  }
};

export const getRecordsFromDB = async (tabId: number): Promise<Record[]> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('tabId');
      const request = index.getAll(tabId);

      request.onsuccess = () => resolve(request.result as Record[]);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[IndexedDB] getRecordsFromDB error:', error);
    return [];
  }
};

export const deleteRecordsFromDB = async (tabId: number): Promise<void> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('tabId');

      const request = index.openCursor(tabId);

      request.onsuccess = event => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve(); // Finished
        }
      };

      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[IndexedDB] deleteRecordsFromDB error:', error);
  }
};
