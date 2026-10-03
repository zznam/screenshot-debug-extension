import { beforeEach, describe, expect, it, vi } from 'vitest';

import { deepRedactSensitiveInfo } from '@extension/shared';
import { captureSettingsStorage, domainSkipListStorage } from '@extension/storage';

import { addOrMergeRecords, getRecords, deleteRecords } from './manage-records.util';
import { deleteRecordsFromDB, getRecordsFromDB, putRecordToDB } from '../services/indexed-db.service';

vi.mock('webextension-polyfill', () => ({ tabs: { get: async () => ({ url: 'https://source.example/' }) } }));
vi.mock('@extension/shared', () => ({ deepRedactSensitiveInfo: vi.fn((value: unknown) => value) }));
vi.mock('@extension/storage', () => ({
  domainSkipListStorage: { isDomainSkipped: vi.fn() },
  captureSettingsStorage: { get: vi.fn() },
}));
vi.mock('../services/indexed-db.service', () => ({
  getRecordsFromDB: vi.fn(),
  putRecordToDB: vi.fn(),
  deleteRecordsFromDB: vi.fn(),
  deleteRecordsBeforeFromDB: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(domainSkipListStorage.isDomainSkipped).mockResolvedValue(false);
  vi.mocked(captureSettingsStorage.get).mockResolvedValue({ retentionMinutes: 0 } as Awaited<
    ReturnType<typeof captureSettingsStorage.get>
  >);
  vi.mocked(getRecordsFromDB).mockResolvedValue([]);
});
describe('source tab privacy', () => {
  it('does not store diagnostics on a skipped source tab', async () => {
    vi.mocked(domainSkipListStorage.isDomainSkipped).mockResolvedValue(true);
    await addOrMergeRecords(601, { url: 'https://api.other.test/', recordType: 'network', type: 'fetch' });
    expect(putRecordToDB).not.toHaveBeenCalled();
  });
  it('uses the source tab URL for redaction rather than the active tab', async () => {
    const record = { url: 'https://api.other.test/', recordType: 'console' as const, type: 'log' };
    await addOrMergeRecords(602, record);
    expect(deepRedactSensitiveInfo).toHaveBeenCalledWith(record, 'https://source.example/');
    expect(putRecordToDB).toHaveBeenCalled();
    await deleteRecords(602);
  });
  it('clears previously collected diagnostics when a skipped source is exported', async () => {
    vi.mocked(domainSkipListStorage.isDomainSkipped).mockResolvedValue(true);
    expect(await getRecords(603)).toEqual([]);
    expect(deleteRecordsFromDB).toHaveBeenCalledWith(603);
    expect(getRecordsFromDB).not.toHaveBeenCalled();
  });
});
