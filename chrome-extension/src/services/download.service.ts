import { zipSync } from 'fflate';

import type { DownloadPayload, DownloadResponse } from '@extension/shared';
import { captureSettingsStorage } from '@extension/storage';

import type { Record as ExtRecord } from '../types';
import { getRecords } from '../utils';
import { buildHarLog } from '../utils/har-builder.util';
import { buildDebugReport } from '../utils/report-builder.util';
import { buildReportMarkdown } from '../utils/report-markdown.util';

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Failed to prepare the download.'));
    reader.onabort = () => reject(new Error('Preparing the download was cancelled.'));
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });

const safeName = (name: string): string =>
  Array.from(name, character => (character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127 ? '-' : character))
    .join('')
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/^\.+|\.+$/g, '')
    .trim()
    .slice(0, 120) || 'capture';
const screenshotFiles = (payload: DownloadPayload) => {
  const counts = new Map<string, number>();
  return payload.screenshots.map(screenshot => {
    const extension = /^data:image\/jpe?g[;,]/i.test(screenshot.src) ? 'jpeg' : 'png';
    const base = `${safeName(payload.name)}${screenshot.isPrimary ? '' : '-full'}`;
    const count = (counts.get(base) ?? 0) + 1;
    counts.set(base, count);
    return { ...screenshot, filename: `${base}${count > 1 ? `-${count}` : ''}.${extension}` };
  });
};
const encodeText = (value: string) => Uint8Array.from(new TextEncoder().encode(value));

const snapshotDebugRecords = async (tabId: number | undefined, saveDebugLog: boolean): Promise<ExtRecord[]> => {
  if (!saveDebugLog || typeof tabId !== 'number') return [];

  const [records, settings] = await Promise.all([getRecords(tabId), captureSettingsStorage.get()]);
  return settings.includePerformance ? records : records.filter(record => record.recordType !== 'performance');
};

const buildJsonDataUrl = (value: unknown) => {
  const json = JSON.stringify(value, null, 2);
  const bytes = encodeText(json);
  let binary = '';

  for (const byte of bytes) binary += String.fromCharCode(byte);

  return `data:application/json;base64,${btoa(binary)}`;
};

const buildReport = (records: ExtRecord[], payload: DownloadPayload) =>
  buildDebugReport(records, {
    timestamp: payload.timestamp,
    host: payload.host,
    url: payload.url,
    title: payload.title,
    screenshots: screenshotFiles(payload).map(screenshot => ({
      type: screenshot.isPrimary ? 'cropped' : 'full-page',
      filename: screenshot.filename,
    })),
  });

export const downloadAssets = async (
  payload: DownloadPayload,
  tabId: number | undefined,
): Promise<DownloadResponse> => {
  // Snapshot first so a slow screenshot download cannot race record cleanup.
  const records = await snapshotDebugRecords(tabId, payload.saveDebugLog);
  const files: string[] = [];
  const downloadIds: number[] = [];

  for (const screenshot of screenshotFiles(payload)) {
    const { filename } = screenshot;
    const downloadId = await chrome.downloads.download({ url: screenshot.src, filename, saveAs: false });
    files.push(filename);
    downloadIds.push(downloadId);
  }

  if (payload.saveDebugLog) {
    const filename = `${safeName(payload.name)}.json`;
    const downloadId = await chrome.downloads.download({
      url: buildJsonDataUrl(buildReport(records, payload)),
      filename,
      saveAs: false,
    });
    files.push(filename);
    downloadIds.push(downloadId);
  }

  return { status: 'success', files, downloadIds };
};

export const downloadZip = async (payload: DownloadPayload, tabId: number | undefined): Promise<DownloadResponse> => {
  // Snapshot before fetching screenshots; converting large images can be slow.
  const records = await snapshotDebugRecords(tabId, payload.saveDebugLog);
  const zipData: globalThis.Record<string, Uint8Array> = {};

  for (const screenshot of screenshotFiles(payload)) {
    const { filename } = screenshot;
    const response = await fetch(screenshot.src);
    if (!response.ok) throw new Error(`Failed to prepare ${filename}.`);
    zipData[filename] = new Uint8Array(await response.arrayBuffer());
  }

  if (payload.saveDebugLog) {
    const report = buildReport(records, payload);
    zipData[`${safeName(payload.name)}.json`] = encodeText(JSON.stringify(report, null, 2));
    zipData['report.md'] = encodeText(buildReportMarkdown(report));
    zipData['network.har'] = encodeText(JSON.stringify(buildHarLog(records, payload.url || 'unknown'), null, 2));
  }

  const blob = new Blob([zipSync(zipData)], { type: 'application/zip' });
  const filename = `${safeName(payload.name)}.zip`;
  const downloadId = await chrome.downloads.download({
    url: await blobToDataUrl(blob),
    filename,
    saveAs: false,
  });

  return { status: 'success', files: [filename], downloadIds: [downloadId] };
};
