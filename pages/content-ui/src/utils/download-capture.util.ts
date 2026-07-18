import type { DownloadRequest, DownloadResponse } from '@extension/shared';

import { deleteRecords } from './slice';

export const downloadCapture = async (request: DownloadRequest): Promise<DownloadResponse> => {
  const response = (await chrome.runtime.sendMessage(request)) as DownloadResponse | undefined;

  if (!response || response.status !== 'success') {
    throw new Error(response?.message || 'The download could not be started.');
  }

  await deleteRecords();
  return response;
};
