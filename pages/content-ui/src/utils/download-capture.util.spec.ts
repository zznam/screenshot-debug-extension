import { beforeEach, describe, expect, it, vi } from 'vitest';

import { downloadCapture } from './download-capture.util';
import { deleteRecords } from './slice';

vi.mock('./slice', () => ({ deleteRecords: vi.fn() }));

const request = {
  type: 'DOWNLOAD_ASSETS' as const,
  payload: {
    screenshots: [],
    name: 'capture',
    timestamp: 1,
    host: 'example.test',
    url: 'https://example.test/',
    title: 'Example',
    saveDebugLog: true,
  },
};

describe('downloadCapture', () => {
  const sendMessage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('chrome', { runtime: { sendMessage } });
    vi.mocked(deleteRecords).mockResolvedValue({ status: 'success' });
  });

  it('clears records only after a confirmed download', async () => {
    sendMessage.mockResolvedValue({ status: 'success', files: ['capture.json'], downloadIds: [7] });

    await expect(downloadCapture(request)).resolves.toMatchObject({ status: 'success' });
    expect(deleteRecords).toHaveBeenCalledOnce();
    expect(sendMessage.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(deleteRecords).mock.invocationCallOrder[0]);
  });

  it('retains records when the background reports a failure', async () => {
    sendMessage.mockResolvedValue({ status: 'error', message: 'Download denied' });

    await expect(downloadCapture(request)).rejects.toThrow('Download denied');
    expect(deleteRecords).not.toHaveBeenCalled();
  });

  it('retains records when the background receiver is unavailable', async () => {
    sendMessage.mockRejectedValue(new Error('Receiving end does not exist'));

    await expect(downloadCapture(request)).rejects.toThrow('Receiving end does not exist');
    expect(deleteRecords).not.toHaveBeenCalled();
  });
});
