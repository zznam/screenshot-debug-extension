import { describe, expect, it, vi } from 'vitest';

import { deleteAiStorageEntries } from './ai-debug-indexed-db.service';
import { handleStorageManagement } from './storage-management.service';
import { deleteDiagnosticSelection } from '../utils/manage-records.util';

vi.mock('webextension-polyfill', () => ({
  runtime: { id: 'extension-id', getURL: (path: string) => `chrome-extension://extension-id/${path}` },
}));
vi.mock('./ai-debug-indexed-db.service', () => ({
  listAiStorageEntries: vi.fn(async () => []),
  deleteAiStorageEntries: vi.fn(),
}));
vi.mock('./indexed-db.service', () => ({
  listStoredDiagnostics: vi.fn(async () => [
    { uuid: 'record', tabId: 7, recordType: 'network', timestamp: 100, url: 'https://example.com' },
  ]),
}));
vi.mock('../utils/manage-records.util', () => ({ deleteDiagnosticSelection: vi.fn() }));

const sender = { id: 'extension-id', url: 'chrome-extension://extension-id/library/index.html?storage=1' };
describe('storage management authorization', () => {
  it('rejects websites, missing senders, another extension and non-library pages', async () => {
    for (const source of [
      {},
      { ...sender, url: 'https://example.com/library/index.html' },
      { ...sender, url: 'chrome-extension://other-id/library/index.html' },
      { ...sender, url: 'chrome-extension://extension-id/popup/index.html' },
    ]) {
      expect((await handleStorageManagement({ type: 'LIBRARY_STORAGE_LIST' }, source)).status).toBe('error');
    }
    expect(deleteAiStorageEntries).not.toHaveBeenCalled();
    expect(deleteDiagnosticSelection).not.toHaveBeenCalled();
  });
  it('returns sizes and metadata without revealing stored record bodies', async () => {
    const response = await handleStorageManagement({ type: 'LIBRARY_STORAGE_LIST' }, sender);
    expect(response).toMatchObject({
      status: 'success',
      data: [{ id: 'record', category: 'diagnostics', sizeBytes: expect.any(Number) }],
    });
    expect(JSON.stringify(response)).not.toContain('recordType');
  });
  it('only deletes selected IDs for a validated category', async () => {
    expect(
      (await handleStorageManagement({ type: 'LIBRARY_STORAGE_DELETE', category: 'unknown', ids: ['record'] }, sender))
        .status,
    ).toBe('error');
    expect(
      (await handleStorageManagement({ type: 'LIBRARY_STORAGE_DELETE', category: 'ai', ids: [7] }, sender)).status,
    ).toBe('error');
    await handleStorageManagement({ type: 'LIBRARY_STORAGE_DELETE', category: 'diagnostics', ids: ['record'] }, sender);
    expect(deleteDiagnosticSelection).toHaveBeenCalledWith(['record']);
    await handleStorageManagement({ type: 'LIBRARY_STORAGE_DELETE', category: 'ai', ids: ['chat'] }, sender);
    expect(deleteAiStorageEntries).toHaveBeenCalledWith(['chat']);
  });
});
