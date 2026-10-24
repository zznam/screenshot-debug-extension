import type { Runtime } from 'webextension-polyfill';
import { runtime } from 'webextension-polyfill';

import type { LibraryResponse, ManagedStorageEntry, StorageCategory } from '@extension/storage';

import { deleteAiStorageEntries, listAiStorageEntries } from './ai-debug-indexed-db.service';
import { listStoredDiagnostics } from './indexed-db.service';
import { deleteDiagnosticSelection } from '../utils/manage-records.util';

const handleStorageManagement = async (
  message: Record<string, unknown>,
  sender: Runtime.MessageSender,
): Promise<LibraryResponse<ManagedStorageEntry[] | null>> => {
  // Content scripts cannot enumerate or erase another page's stored evidence.
  const senderUrl = sender.url ? new URL(sender.url) : null;
  const libraryUrl = new URL(runtime.getURL('library/index.html'));
  if (
    sender.id !== runtime.id ||
    !senderUrl ||
    senderUrl.protocol !== libraryUrl.protocol ||
    senderUrl.host !== libraryUrl.host ||
    senderUrl.pathname !== libraryUrl.pathname
  )
    return { status: 'error', message: 'Open storage management from the capture library.' };
  if (message.type === 'LIBRARY_STORAGE_LIST') {
    const [ai, records] = await Promise.all([listAiStorageEntries(), listStoredDiagnostics()]);
    return {
      status: 'success',
      data: [
        ...ai,
        ...records.map(record => ({
          id: record.uuid,
          category: 'diagnostics' as const,
          title: `${record.recordType || 'Diagnostic'} record`,
          url: typeof record.url === 'string' ? record.url : '',
          updatedAt: Number(record.timestamp) || 0,
          sizeBytes: new TextEncoder().encode(JSON.stringify(record)).byteLength,
        })),
      ],
    };
  }
  const category = message.category as StorageCategory;
  const ids = message.ids;
  if (
    !Array.isArray(ids) ||
    !ids.length ||
    ids.length > 10_000 ||
    ids.some(id => typeof id !== 'string' || !id || id.length > 200) ||
    !['ai', 'diagnostics'].includes(category)
  )
    return { status: 'error', message: 'Choose valid saved items to delete.' };
  if (category === 'ai') await deleteAiStorageEntries(ids);
  else await deleteDiagnosticSelection(ids);
  return { status: 'success', data: null };
};

export { handleStorageManagement };
