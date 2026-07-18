import { strToU8, unzipSync } from 'fflate';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { captureSettingsStorage } from '@extension/storage';
import type { CaptureSettings } from '@extension/storage';

import { downloadAssets, downloadZip } from './download.service';
import type { Record as ExtRecord } from '../types';
import { getRecords } from '../utils';

vi.mock('@extension/storage', () => ({
  captureSettingsStorage: { get: vi.fn() },
}));

vi.mock('../utils', () => ({
  getRecords: vi.fn(),
}));

const payload = {
  screenshots: [{ src: 'data:image/png;base64,cG5n', isPrimary: true }],
  name: 'capture',
  timestamp: 1,
  host: 'example.test',
  url: 'https://example.test/',
  title: 'Example',
  saveDebugLog: true,
};

const decodeJsonDataUrl = (url: string) => JSON.parse(atob(url.split(',')[1]));

describe('capture downloads', () => {
  const download = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('chrome', { downloads: { download } });
    vi.mocked(captureSettingsStorage.get).mockResolvedValue({
      exportFormat: 'individual',
      screenshotFormat: 'png',
      screenshotQuality: 100,
      includePerformance: false,
      retentionMinutes: 0,
      autoScreenshotOnError: false,
    } satisfies CaptureSettings);
    vi.mocked(getRecords).mockResolvedValue([]);
    download.mockResolvedValueOnce(10).mockResolvedValueOnce(11);
  });

  it('snapshots records before starting individual downloads and returns every download ID', async () => {
    let resolveRecords: (records: ExtRecord[]) => void = () => undefined;
    vi.mocked(getRecords).mockImplementation(
      () => new Promise(resolve => (resolveRecords = resolve)) as ReturnType<typeof getRecords>,
    );

    const resultPromise = downloadAssets(payload, 42);
    await Promise.resolve();
    expect(download).not.toHaveBeenCalled();

    resolveRecords([
      {
        recordType: 'network',
        type: 'xmlhttprequest',
        url: 'https://example.test/api',
        method: 'GET',
      },
    ]);

    await expect(resultPromise).resolves.toEqual({
      status: 'success',
      files: ['capture.png', 'capture.json'],
      downloadIds: [10, 11],
    });
    expect(decodeJsonDataUrl(download.mock.calls[1][0].url).network.requests).toHaveLength(1);
  });

  it('still creates a valid JSON report when no records were collected', async () => {
    await downloadAssets(payload, 42);

    const report = decodeJsonDataUrl(download.mock.calls[1][0].url);
    expect(report.network.summary).toEqual({ total: 0, failed: 0 });
    expect(report.console).toEqual({ errors: [], warnings: [], info: [] });
  });

  it('exports only screenshots when debug records are disabled', async () => {
    const result = await downloadAssets({ ...payload, saveDebugLog: false }, 42);

    expect(getRecords).not.toHaveBeenCalled();
    expect(download).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ status: 'success', files: ['capture.png'], downloadIds: [10] });
  });

  it('rejects the operation when a download cannot be started', async () => {
    download.mockReset().mockRejectedValue(new Error('Download denied'));

    await expect(downloadAssets(payload, 42)).rejects.toThrow('Download denied');
  });

  it('builds one ZIP containing the screenshot, JSON report, and HAR file', async () => {
    download.mockReset().mockResolvedValue(20);
    vi.mocked(getRecords).mockResolvedValue([
      {
        recordType: 'console',
        type: 'console',
        method: 'error',
        url: 'https://example.test/',
      } as ExtRecord,
    ]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => strToU8('png').buffer }));

    const result = await downloadZip(payload, 42);

    expect(result).toEqual({ status: 'success', files: ['capture.zip'], downloadIds: [20] });
    const zipUrl = download.mock.calls[0][0].url as string;
    const entries = unzipSync(Uint8Array.from(atob(zipUrl.split(',')[1]), character => character.charCodeAt(0)));
    expect(Object.keys(entries).sort()).toEqual(['capture.json', 'capture.png', 'network.har']);
    expect(JSON.parse(new TextDecoder().decode(entries['capture.json'])).console.errors).toHaveLength(1);
  });
});
