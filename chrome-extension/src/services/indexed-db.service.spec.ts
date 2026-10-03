import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';

import { deleteRecordsBeforeFromDB, getRecordsFromDB, putRecordToDB } from './indexed-db.service';

describe('diagnostic retention', () => {
  it('deletes expired persisted records across tabs while keeping recent ones', async () => {
    await putRecordToDB(501, {
      uuid: 'old',
      timestamp: 100,
      url: 'https://example.test',
      type: 'log',
      recordType: 'console',
    });
    await putRecordToDB(502, {
      uuid: 'recent',
      timestamp: 1000,
      url: 'https://example.test',
      type: 'log',
      recordType: 'console',
    });
    await deleteRecordsBeforeFromDB(500);
    expect(await getRecordsFromDB(501)).toEqual([]);
    expect(await getRecordsFromDB(502)).toHaveLength(1);
  });
});
