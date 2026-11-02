import type { CaptureDocument } from '@extension/shared';

import type { Mask } from './image-tools';
import type { ReportFields } from './review-export';

const DRAFT_PREFIX = 'review-report-draft:';
const MAX_DRAFT_LENGTH = 512_000;
const severityValues = ['', 'low', 'medium', 'high', 'critical'] as const;
interface DraftImage {
  id: string;
  previewAssetId: string;
  included: boolean;
  masks: Mask[];
}
interface ReportDraft {
  version: 1;
  /** Absent only on drafts written before concurrent-tab protection. */
  generation?: string;
  captureRevision: number;
  savedAt: number;
  fields: ReportFields;
  images: DraftImage[];
  selected: number[];
}
type DraftResult = { status: 'missing' } | { status: 'invalid' | 'stale' } | { status: 'ready'; draft: ReportDraft };
type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const draftKey = (id: string) => `${DRAFT_PREFIX}${id}`;
class ReportDraftConflictError extends Error {
  constructor() {
    super('The saved draft changed in another tab. Restore it or explicitly replace it before saving.');
    this.name = 'ReportDraftConflictError';
  }
}
const checkExpectedDraft = (storage: DraftStorage, id: string, expectedToken: string | null | undefined) => {
  if (expectedToken !== undefined && storage.getItem(draftKey(id)) !== expectedToken)
    throw new ReportDraftConflictError();
};
// Browser tabs share this lock. Keep the revision check and write in one locked operation.
const withReportDraftLock = <T>(id: string, task: () => Promise<T> | T): Promise<T> => {
  if (!navigator.locks) return Promise.reject(new Error('Safe draft saving is unavailable in this browser.'));
  return navigator.locks.request(draftKey(id), task);
};
const isMask = (value: unknown): value is Mask => {
  if (!value || typeof value !== 'object') return false;
  const mask = value as Mask;
  return (
    [mask.x, mask.y, mask.width, mask.height].every(number => Number.isFinite(number) && number >= 0 && number <= 1) &&
    mask.width > 0 &&
    mask.height > 0 &&
    mask.x + mask.width <= 1.000001 &&
    mask.y + mask.height <= 1.000001
  );
};
const validFields = (value: unknown): value is ReportFields => {
  if (!value || typeof value !== 'object') return false;
  const fields = value as ReportFields;
  return (
    [fields.title, fields.steps, fields.expected, fields.actual, fields.sourceUrl].every(
      field => typeof field === 'string' && field.length <= 10_000,
    ) &&
    (fields.environment === undefined ||
      (typeof fields.environment === 'string' && fields.environment.length <= 10_000)) &&
    (fields.severity === undefined || severityValues.includes(fields.severity))
  );
};
const parseReportDraft = (raw: string | null, capture: CaptureDocument): DraftResult => {
  if (!raw) return { status: 'missing' };
  try {
    if (raw.length > MAX_DRAFT_LENGTH) return { status: 'invalid' };
    const draft = JSON.parse(raw) as ReportDraft;
    if (
      !draft ||
      draft.version !== 1 ||
      (draft.generation !== undefined &&
        (typeof draft.generation !== 'string' || !draft.generation || draft.generation.length > 80)) ||
      !Number.isSafeInteger(draft.captureRevision) ||
      !Number.isFinite(draft.savedAt) ||
      !validFields(draft.fields) ||
      !Array.isArray(draft.images) ||
      !Array.isArray(draft.selected)
    )
      return { status: 'invalid' };
    if (
      draft.captureRevision !== capture.revision ||
      draft.images.length !== capture.screenshots.length ||
      draft.images.some(
        (image, index) =>
          !image ||
          image.id !== capture.screenshots[index]?.id ||
          image.previewAssetId !== capture.screenshots[index]?.previewAssetId,
      )
    )
      return { status: 'stale' };
    if (
      draft.images.some(
        image =>
          typeof image.included !== 'boolean' ||
          !Array.isArray(image.masks) ||
          image.masks.length > 200 ||
          !image.masks.every(isMask),
      ) ||
      draft.selected.some(index => !Number.isInteger(index) || index < 0 || index >= capture.diagnostics.length) ||
      new Set(draft.selected).size !== draft.selected.length
    )
      return { status: 'invalid' };
    return { status: 'ready', draft };
  } catch {
    return { status: 'invalid' };
  }
};
const readReportDraftSnapshot = (storage: DraftStorage, capture: CaptureDocument) => {
  const token = storage.getItem(draftKey(capture.id));
  // Comparing the full saved value also protects legacy drafts without a generation.
  return { token, result: parseReportDraft(token, capture) };
};
const readReportDraft = (storage: DraftStorage, capture: CaptureDocument): DraftResult =>
  readReportDraftSnapshot(storage, capture).result;
const saveReportDraft = (
  storage: DraftStorage,
  capture: CaptureDocument,
  fields: ReportFields,
  images: { id: string; included: boolean; masks: Mask[] }[],
  selected: number[],
  expectedToken?: string | null,
) => {
  checkExpectedDraft(storage, capture.id, expectedToken);
  const draft: ReportDraft = {
    version: 1,
    generation: crypto.randomUUID(),
    captureRevision: capture.revision,
    savedAt: Date.now(),
    // Store only editable report fields, never review approval or the capture document.
    fields: {
      title: fields.title,
      steps: fields.steps,
      expected: fields.expected,
      actual: fields.actual,
      sourceUrl: fields.sourceUrl,
      severity: fields.severity ?? '',
      environment: fields.environment ?? '',
    },
    images: images.map((image, index) => ({
      id: image.id,
      previewAssetId: capture.screenshots[index]?.previewAssetId ?? '',
      included: image.included,
      masks: image.masks.map(mask => ({ x: mask.x, y: mask.y, width: mask.width, height: mask.height })),
    })),
    selected: [...selected],
  };
  const raw = JSON.stringify(draft);
  if (raw.length > MAX_DRAFT_LENGTH) throw new Error('This report draft is too large to save locally.');
  if (parseReportDraft(raw, capture).status !== 'ready')
    throw new Error('This report draft contains invalid fields or too many masks. Use up to 200 masks per image.');
  storage.setItem(draftKey(capture.id), raw);
  return draft;
};
const listReportDraftIds = (storage: Pick<Storage, 'length' | 'key'>) => {
  const ids: string[] = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key?.startsWith(DRAFT_PREFIX)) ids.push(key.slice(DRAFT_PREFIX.length));
  }
  return ids;
};
const discardReportDraft = (storage: DraftStorage, id: string, expectedToken?: string | null) => {
  checkExpectedDraft(storage, id, expectedToken);
  storage.removeItem(draftKey(id));
};

export {
  draftKey,
  readReportDraft,
  readReportDraftSnapshot,
  saveReportDraft,
  discardReportDraft,
  listReportDraftIds,
  severityValues,
  ReportDraftConflictError,
  withReportDraftLock,
};
export type { DraftResult, ReportDraft };
