export type LibrarySaveMode = 'ask' | 'manual' | 'automatic';

export interface CaptureSource {
  url: string;
  title: string;
  domain: string;
  capturedAt: number;
}

export interface CaptureAnnotations {
  objects: unknown[];
  meta?: {
    sizes: { natural: { width: number; height: number }; fit: { width: number; height: number } };
    scale: number;
  };
}

export interface LibraryScreenshot {
  id: string;
  originalAssetId: string;
  previewAssetId: string;
  annotations: CaptureAnnotations;
  isPrimary: boolean;
}

export interface CaptureDocument {
  schemaVersion: 1;
  id: string;
  revision: number;
  kind: 'screenshots';
  title: string;
  tags: string[];
  source: CaptureSource;
  createdAt: number;
  updatedAt: number;
  screenshots: LibraryScreenshot[];
  diagnostics: unknown[];
  sizeBytes: number;
}

export interface CaptureSummary extends Omit<CaptureDocument, 'screenshots' | 'diagnostics'> {
  screenshotCount: number;
  diagnosticCount: number;
  thumbnail: string;
}

export interface CaptureSnapshot {
  id: string;
  captureId: string;
  source: CaptureSource;
  diagnostics: unknown[];
}

export interface ScreenshotSavePayload {
  id: string;
  expectedRevision: number;
  title: string;
  snapshotId: string;
  screenshots: {
    id: string;
    original: string;
    preview: string;
    thumbnail: string;
    annotations: CaptureAnnotations;
    isPrimary: boolean;
  }[];
}

export type LibraryResponse<T> = { status: 'success'; data: T } | { status: 'error'; message: string };

/** Edits replace flattened previews and layers; original assets and context stay frozen. */
export interface ScreenshotEditPayload {
  id: string;
  expectedRevision: number;
  title: string;
  thumbnail: string;
  screenshots: { id: string; preview: string; annotations: CaptureAnnotations }[];
}
