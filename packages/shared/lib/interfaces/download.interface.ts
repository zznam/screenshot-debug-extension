import type { Screenshot } from './screenshot.interface.js';

export type DownloadMessageType = 'DOWNLOAD_ASSETS' | 'DOWNLOAD_ZIP';

export type DownloadScreenshot = Pick<Screenshot, 'src' | 'isPrimary'>;

export interface DownloadPayload {
  screenshots: DownloadScreenshot[];
  name: string;
  timestamp: number;
  host: string;
  url: string;
  title: string;
  saveDebugLog: boolean;
}

export interface DownloadRequest {
  type: DownloadMessageType;
  payload: DownloadPayload;
}

export type DownloadResponse =
  | {
      status: 'success';
      files: string[];
      downloadIds: number[];
    }
  | {
      status: 'error';
      message: string;
    };
