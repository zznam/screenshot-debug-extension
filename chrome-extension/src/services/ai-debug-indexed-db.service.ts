import type { AiDebugSession, AiDebugSessionSummary } from '@extension/shared';

const DB_NAME = 'screenshot_debug_ai_v1';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';

let databasePromise: Promise<IDBDatabase> | null = null;

const openDatabase = (): Promise<IDBDatabase> => {
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (database.objectStoreNames.contains(STORE_NAME)) return;
      const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      store.createIndex('sourceId', 'context.sourceId', { unique: false });
      store.createIndex('sourceTabId', 'context.sourceTabId', { unique: false });
      store.createIndex('updatedAt', 'updatedAt', { unique: false });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return databasePromise;
};

const requestResult = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const putAiDebugSession = async (session: AiDebugSession): Promise<void> => {
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, 'readwrite');
  await requestResult(transaction.objectStore(STORE_NAME).put(session));
};

const getAiDebugSession = async (sessionId: string): Promise<AiDebugSession | null> => {
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, 'readonly');
  const result = await requestResult(transaction.objectStore(STORE_NAME).get(sessionId));
  return (result as AiDebugSession | undefined) ?? null;
};

const getSessionByIndex = async (indexName: 'sourceId' | 'sourceTabId', value: string | number) => {
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, 'readonly');
  const result = await requestResult(transaction.objectStore(STORE_NAME).index(indexName).getAll(value));
  return ((result as AiDebugSession[]) ?? []).sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
};

const findAiDebugSession = async (sourceId: string, sourceTabId: number): Promise<AiDebugSession | null> =>
  (await getSessionByIndex('sourceId', sourceId)) ?? (await getSessionByIndex('sourceTabId', sourceTabId));

const listAiDebugSessions = async (): Promise<AiDebugSessionSummary[]> => {
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, 'readonly');
  const sessions = (await requestResult(transaction.objectStore(STORE_NAME).getAll())) as AiDebugSession[];
  return sessions
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(session => ({
      id: session.id,
      sourceTitle: session.context.sourceTitle,
      sourceUrl: session.context.sourceUrl,
      updatedAt: session.updatedAt,
      messageCount: session.messages.length,
    }));
};

const deleteAiDebugSession = async (sessionId: string): Promise<void> => {
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, 'readwrite');
  await requestResult(transaction.objectStore(STORE_NAME).delete(sessionId));
};

const detachAiDebugSessionsFromTab = async (tabId: number): Promise<void> => {
  const session = await getSessionByIndex('sourceTabId', tabId);
  if (!session) return;
  await putAiDebugSession({
    ...session,
    updatedAt: Date.now(),
    context: { ...session.context, sourceTabId: null },
  });
};

export {
  deleteAiDebugSession,
  detachAiDebugSessionsFromTab,
  findAiDebugSession,
  getAiDebugSession,
  listAiDebugSessions,
  putAiDebugSession,
};
