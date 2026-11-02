import { describe, expect, it, vi } from 'vitest';

import type { CaptureDocument } from '@extension/shared';

import {
  discardReportDraft,
  listReportDraftIds,
  readReportDraft,
  readReportDraftSnapshot,
  ReportDraftConflictError,
  saveReportDraft,
} from './report-draft';
import { applyReportTemplate } from './report-templates';
import type { ReportFields } from './review-export';

const capture = {
  id: 'capture-1',
  revision: 3,
  screenshots: [{ id: 'image-1', previewAssetId: 'preview-1' }],
  diagnostics: [{ message: 'Selected record' }],
} as CaptureDocument;
const fields: ReportFields = {
  title: 'Checkout issue',
  steps: 'Click Pay',
  expected: 'Payment completes',
  actual: 'Error',
  sourceUrl: '',
  severity: 'high',
  environment: 'Chrome on macOS',
};
const images = [{ id: 'image-1', included: false, masks: [{ x: 0.2, y: 0.3, width: 0.4, height: 0.1 }] }];
const makeStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
};

describe('local report drafts', () => {
  it('finds orphan drafts without treating unrelated preferences as drafts', () => {
    const keys = ['unrelated', 'review-report-draft:deleted-capture', 'review-report-draft:kept-capture'];
    expect(listReportDraftIds({ length: keys.length, key: index => keys[index] ?? null })).toEqual([
      'deleted-capture',
      'kept-capture',
    ]);
  });
  it('roundtrips selected evidence, masks and context without saving review approval or hidden capture data', () => {
    const storage = makeStorage();
    expect(readReportDraft(storage, capture)).toEqual({ status: 'missing' });
    const draft = saveReportDraft(storage, capture, fields, images, [0]);
    expect(readReportDraft(storage, capture)).toEqual({ status: 'ready', draft });
    expect(draft.fields).toEqual(fields);
    expect(draft.images[0]).toEqual({ ...images[0], previewAssetId: 'preview-1' });
    expect(JSON.stringify(draft)).not.toMatch(/reviewed|diagnostics|Selected record|originalAssetId/);
    discardReportDraft(storage, capture.id);
    expect(readReportDraft(storage, capture)).toEqual({ status: 'missing' });
  });

  it('rejects changed revisions and image assets instead of reusing old masks', () => {
    const storage = makeStorage();
    saveReportDraft(storage, capture, fields, images, [0]);
    expect(readReportDraft(storage, { ...capture, revision: 4 })).toEqual({ status: 'stale' });
    expect(
      readReportDraft(storage, {
        ...capture,
        screenshots: [{ ...capture.screenshots[0]!, previewAssetId: 'replaced-preview' }],
      }),
    ).toEqual({ status: 'stale' });
  });

  it.each([
    (draft: Record<string, unknown>) => (draft.selected = [2]),
    (draft: Record<string, unknown>) => (draft.selected = [0, 0]),
    (draft: Record<string, unknown>) => (draft.fields = { ...fields, severity: 'unexpected' }),
    (draft: Record<string, unknown>) => (draft.fields = { ...fields, steps: 3 }),
    (draft: Record<string, unknown>) =>
      (draft.images = [
        { ...images[0], previewAssetId: 'preview-1', masks: [{ x: 0.9, y: 0, width: 0.5, height: 1 }] },
      ]),
  ])('rejects malformed or out-of-range draft values', mutate => {
    const storage = makeStorage();
    const draft = saveReportDraft(storage, capture, fields, images, [0]);
    mutate(draft as unknown as Record<string, unknown>);
    storage.setItem('review-report-draft:capture-1', JSON.stringify(draft));
    expect(readReportDraft(storage, capture)).toEqual({ status: 'invalid' });
  });

  it('handles corrupt and oversized data without failing the report page', () => {
    const storage = makeStorage();
    storage.setItem('review-report-draft:capture-1', '{');
    expect(readReportDraft(storage, capture)).toEqual({ status: 'invalid' });
    storage.setItem('review-report-draft:capture-1', 'x'.repeat(512_001));
    expect(readReportDraft(storage, capture)).toEqual({ status: 'invalid' });
    expect(() => saveReportDraft(storage, capture, { ...fields, steps: 'x'.repeat(512_001) }, images, [])).toThrow(
      'too large',
    );
  });

  it('preserves the existing draft when a write fails', () => {
    const storage = makeStorage();
    const draft = saveReportDraft(storage, capture, fields, images, []);
    const failingStorage = {
      ...storage,
      setItem: vi.fn(() => {
        throw new Error('Quota exceeded');
      }),
    };
    expect(() => saveReportDraft(failingStorage, capture, { ...fields, actual: 'New text' }, images, [])).toThrow(
      'Quota',
    );
    expect(readReportDraft(storage, capture)).toEqual({ status: 'ready', draft });
  });

  it('requires bounded masks before writing', () => {
    const storage = makeStorage();
    expect(() =>
      saveReportDraft(storage, capture, fields, [{ ...images[0]!, masks: Array(201).fill(images[0]!.masks[0]) }], []),
    ).toThrow('200 masks');
    expect(readReportDraft(storage, capture)).toEqual({ status: 'missing' });
  });

  it('rejects stale writers and stale discards while preserving the newest saved report', () => {
    const storage = makeStorage();
    const initial = readReportDraftSnapshot(storage, capture);
    expect(initial.token).toBeNull();
    const first = saveReportDraft(storage, capture, fields, images, [], initial.token);
    expect(() =>
      saveReportDraft(storage, capture, { ...fields, actual: 'Stale tab' }, images, [], initial.token),
    ).toThrow(ReportDraftConflictError);
    const observed = readReportDraftSnapshot(storage, capture);
    const newer = saveReportDraft(
      storage,
      capture,
      { ...fields, actual: 'New investigation' },
      images,
      [],
      observed.token,
    );
    expect(newer.generation).not.toBe(first.generation);
    expect(() => discardReportDraft(storage, capture.id, observed.token)).toThrow(ReportDraftConflictError);
    expect(readReportDraft(storage, capture)).toEqual({ status: 'ready', draft: newer });
    // Capture deletion deliberately removes any current draft, regardless of who saved it.
    discardReportDraft(storage, capture.id);
    expect(readReportDraft(storage, capture)).toEqual({ status: 'missing' });
  });

  it('can restore and update legacy drafts that have no generation identifier', () => {
    const storage = makeStorage();
    const oldDraft = saveReportDraft(storage, capture, fields, images, []);
    delete oldDraft.generation;
    storage.setItem('review-report-draft:capture-1', JSON.stringify(oldDraft));
    const legacy = readReportDraftSnapshot(storage, capture);
    expect(legacy.result).toEqual({ status: 'ready', draft: oldDraft });
    const saved = saveReportDraft(storage, capture, { ...fields, actual: 'Updated' }, images, [], legacy.token);
    expect(saved.generation).toEqual(expect.any(String));
    expect(() => saveReportDraft(storage, capture, fields, images, [], legacy.token)).toThrow(ReportDraftConflictError);
    discardReportDraft(storage, capture.id, readReportDraftSnapshot(storage, capture).token);
    expect(readReportDraft(storage, capture)).toEqual({ status: 'missing' });
  });
});

describe('report templates', () => {
  it('replaces report narrative while preserving title, privacy choices and environment', () => {
    const templated = applyReportTemplate(fields, 'accessibility');
    expect(templated.steps).toContain('assistive technology');
    expect(templated.title).toBe(fields.title);
    expect(templated.sourceUrl).toBe('');
    expect(templated.severity).toBe('high');
    expect(templated.environment).toBe(fields.environment);
    expect(applyReportTemplate(fields, 'blank')).toEqual({ ...fields, steps: '', expected: '', actual: '' });
    expect(applyReportTemplate(fields, 'regression').steps).toContain('last working version');
    expect(applyReportTemplate(fields, 'bug').steps).toContain('affected page');
  });
});
