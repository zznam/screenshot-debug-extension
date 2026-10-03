import { captureSettingsStorage } from '@extension/storage';

import { pruneExpiredRecords } from '../utils/manage-records.util';

const RETENTION_ALARM = 'debug-record-retention';

export const initRetentionCleanup = () => {
  const cleanup = () => void pruneExpiredRecords().catch(error => console.warn('Debug record cleanup failed:', error));
  chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === RETENTION_ALARM) cleanup();
  });
  captureSettingsStorage.subscribe(cleanup);
  void chrome.alarms.create(RETENTION_ALARM, { periodInMinutes: 1 });
  cleanup();
};
