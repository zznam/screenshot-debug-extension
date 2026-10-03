import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Runtime } from 'webextension-polyfill';

import { appendLibraryChunk, saveLibrarySession, debugModeStorage, captureSettingsStorage } from '@extension/storage';

import { getCaptureOwner, handleLibraryMessage } from './capture-library.service';
import { getRecords } from '../utils/manage-records.util';

vi.mock('../utils/manage-records.util', () => ({ getRecords: vi.fn() }));
vi.mock('@extension/shared', async () => {
  const { deepRedactSensitiveInfo } = await import('../../../packages/shared/lib/utils/redact-sensitive-info.util');
  return { deepRedactSensitiveInfo };
});
vi.mock('@extension/storage', () => ({
  appendLibraryChunk: vi.fn(),
  beginLibraryUpload: vi.fn(),
  cleanLibraryStaging: vi.fn(),
  commitScreenshotCapture: vi.fn(),
  discardLibraryUpload: vi.fn(),
  getLibrarySession: vi.fn(),
  readLibraryUpload: vi.fn(),
  saveLibrarySession: vi.fn(),
  captureSettingsStorage: { get: vi.fn() },
  debugModeStorage: { getDebugMode: vi.fn() },
}));
const sender = {
  id: 'extension',
  frameId: 0,
  url: 'http://localhost:3000/checkout',
  documentId: 'document-1',
  tab: { id: 17, title: 'Checkout', index: 0, highlighted: true, active: true, pinned: false, incognito: false },
} as Runtime.MessageSender;

describe('library ingestion boundary', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('chrome', { runtime: { id: 'extension' } });
    vi.mocked(debugModeStorage.getDebugMode).mockResolvedValue(true);
    vi.mocked(captureSettingsStorage.get).mockResolvedValue({ includePerformance: false } as never);
    vi.mocked(getRecords).mockResolvedValue([]);
  });
  it('binds uploads to the sender document and rejects extension pages, other extensions, and subframes', () => {
    expect(getCaptureOwner(sender)).toBe('17:document-1');
    for (const invalid of [
      { ...sender, id: 'foreign' },
      { ...sender, frameId: 1 },
      { ...sender, tab: undefined },
      { ...sender, url: 'chrome-extension://extension/library/index.html' },
    ])
      expect(() => getCaptureOwner(invalid)).toThrow('source page');
  });
  it('freezes only the source tab records and redacts even localhost secrets', async () => {
    vi.mocked(getRecords).mockResolvedValue([
      { recordType: 'console', type: 'error', url: sender.url!, password: 'super-secret' },
      { recordType: 'performance', type: 'metric', url: sender.url! },
    ]);
    const response = await handleLibraryMessage({ type: 'LIBRARY:SNAPSHOT' }, sender);
    expect(response.status).toBe('success');
    expect(getRecords).toHaveBeenCalledWith(17);
    const snapshot = vi.mocked(saveLibrarySession).mock.calls[0]![0];
    expect(snapshot.source.url).toBe(sender.url);
    expect(snapshot.diagnostics).toHaveLength(1);
    expect(JSON.stringify(snapshot.diagnostics)).not.toContain('super-secret');
  });
  it('does not capture diagnostics when collection is disabled', async () => {
    vi.mocked(debugModeStorage.getDebugMode).mockResolvedValue(false);
    await handleLibraryMessage({ type: 'LIBRARY:SNAPSHOT' }, sender);
    expect(getRecords).not.toHaveBeenCalled();
    expect(saveLibrarySession).toHaveBeenCalledWith(expect.objectContaining({ diagnostics: [] }));
  });
  it('turns quota errors into recovery guidance', async () => {
    vi.mocked(appendLibraryChunk).mockRejectedValue(new DOMException('Full', 'QuotaExceededError'));
    expect(
      await handleLibraryMessage({ type: 'LIBRARY:CHUNK', uploadId: 'x', index: 0, text: 'chunk' }, sender),
    ).toMatchObject({ status: 'error', message: expect.stringContaining('Download this capture') });
  });
  it('does not expose library reads or deletion to content scripts', async () => {
    for (const type of ['LIBRARY:LIST', 'LIBRARY:GET', 'LIBRARY:DELETE'])
      expect(await handleLibraryMessage({ type }, sender)).toMatchObject({ status: 'error' });
  });
});
