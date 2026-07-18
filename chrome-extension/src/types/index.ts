import type { AiDebugRequest, AiDebugResponse, DownloadRequest, DownloadResponse } from '@extension/shared';

export type CaptureType = 'area' | 'viewport' | 'full-page';
export type CaptureState = 'idle' | 'capturing' | 'unsaved';

export type BgMessage =
  | { type: 'EXIT_CAPTURE' }
  | { type: 'ADD_RECORD'; data: unknown }
  | { type: 'GET_RECORDS' }
  | { type: 'DELETE_RECORDS' }
  | { type: 'AUTH_START' }
  | { action: 'checkNativeCapture' }
  | { action: 'captureVisibleTab' }
  | DownloadRequest
  | AiDebugRequest;

export type BgResponse =
  | { status: 'success' }
  | { status: 'error'; message: string }
  | { records: unknown[] }
  | { tab: unknown }
  | { success: boolean; dataUrl?: string; message?: string }
  | { ok: boolean; error?: string }
  | { isAvailable: boolean }
  | DownloadResponse
  | AiDebugResponse;

export type RecordType = 'events' | 'network' | 'console' | 'cookies' | 'performance';
export interface Record {
  recordType: RecordType;
  url: string;
  requestId?: string;
  requestBody?: {
    raw?: { bytes: ArrayBuffer }[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    decoded?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parsed?: any;
  };
  type: string;
  domain?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}
