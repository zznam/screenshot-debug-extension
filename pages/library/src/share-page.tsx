import { useEffect, useRef, useState } from 'react';

import { useUnsavedChanges } from '@extension/shared';
import type { CaptureDocument } from '@extension/shared';
import { getLibraryAsset, getLibraryCapture } from '@extension/storage';

import { downloadBlob, flattenImage } from './image-tools';
import type { Mask } from './image-tools';
import {
  discardReportDraft,
  draftKey,
  readReportDraftSnapshot,
  ReportDraftConflictError,
  saveReportDraft,
  severityValues,
  withReportDraftLock,
} from './report-draft';
import type { DraftResult } from './report-draft';
import { applyReportTemplate, reportTemplates } from './report-templates';
import type { ReportTemplate } from './report-templates';
import { buildReviewedZip, reportJson, reportMarkdown, sanitizeRecord, sensitiveFindings } from './review-export';
import type { ReportFields } from './review-export';

interface ShareImage {
  id: string;
  blob: Blob;
  url: string;
  included: boolean;
  masks: Mask[];
}

const MaskImage = ({ image, index, change }: { image: ShareImage; index: number; change: (masks: Mask[]) => void }) => {
  const start = useRef<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<Mask | null>(null);
  const [region, setRegion] = useState({ x: 0, y: 0, width: 20, height: 10 });
  const point = (event: React.PointerEvent<HTMLButtonElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
      y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
    };
  };
  const rectangle = (end: { x: number; y: number }): Mask => ({
    x: Math.min(start.current!.x, end.x),
    y: Math.min(start.current!.y, end.y),
    width: Math.abs(start.current!.x - end.x),
    height: Math.abs(start.current!.y - end.y),
  });
  return (
    <div className="review-image">
      <button
        type="button"
        className="mask-surface"
        aria-label={`Draw a privacy mask on screenshot ${index + 1}`}
        onPointerDown={event => {
          start.current = point(event);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={event => {
          if (start.current) setDraft(rectangle(point(event)));
        }}
        onPointerUp={event => {
          if (start.current) {
            const mask = rectangle(point(event));
            if (mask.width > 0.001 && mask.height > 0.001) change([...image.masks, mask]);
          }
          start.current = null;
          setDraft(null);
        }}
        onPointerCancel={() => {
          start.current = null;
          setDraft(null);
        }}
        onClick={event => {
          if (event.detail === 0) change([...image.masks, { x: 0.25, y: 0.25, width: 0.5, height: 0.1 }]);
        }}>
        <img src={image.url} alt={`Screenshot ${index + 1} to review`} draggable={false} />
        {[...image.masks, ...(draft ? [draft] : [])].map((mask, key) => (
          <span
            key={key}
            className="privacy-mask"
            style={{
              left: `${mask.x * 100}%`,
              top: `${mask.y * 100}%`,
              width: `${mask.width * 100}%`,
              height: `${mask.height * 100}%`,
            }}
          />
        ))}
      </button>
      <details>
        <summary>Position a mask with the keyboard</summary>
        <div className="mask-coordinates">
          {(['x', 'y', 'width', 'height'] as const).map(key => (
            <label key={key}>
              {key} (%)
              <input
                aria-label={`Mask ${key} for screenshot ${index + 1}`}
                type="number"
                min={0}
                max={100}
                value={region[key]}
                onChange={event =>
                  setRegion(previous => ({
                    ...previous,
                    [key]: Math.max(0, Math.min(100, Number(event.target.value))),
                  }))
                }
              />
            </label>
          ))}
          <button
            type="button"
            disabled={!region.width || !region.height || region.x >= 100 || region.y >= 100}
            onClick={() =>
              change([
                ...image.masks,
                {
                  x: region.x / 100,
                  y: region.y / 100,
                  width: Math.min(region.width, 100 - region.x) / 100,
                  height: Math.min(region.height, 100 - region.y) / 100,
                },
              ])
            }>
            Add mask
          </button>
        </div>
      </details>
      <button type="button" disabled={!image.masks.length} onClick={() => change(image.masks.slice(0, -1))}>
        Undo last mask
      </button>
      <span className="library-muted"> {image.masks.length} opaque masks</span>
    </div>
  );
};

const SharePage = ({ id }: { id: string }) => {
  const [capture, setCapture] = useState<CaptureDocument>();
  const [images, setImages] = useState<ShareImage[]>([]);
  const [fields, setFields] = useState<ReportFields>({ title: '', steps: '', expected: '', actual: '', sourceUrl: '' });
  const [selected, setSelected] = useState<number[]>([]);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [dirty, setDirty] = useState(false);
  const [draft, setDraft] = useState<DraftResult>({ status: 'missing' });
  const [draftConflict, setDraftConflict] = useState(false);
  const [template, setTemplate] = useState<ReportTemplate>('bug');
  const [replaceTemplate, setReplaceTemplate] = useState(false);
  const operation = useRef(false);
  const draftToken = useRef<string | null>(null);
  useUnsavedChanges(dirty || busy);
  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    void (async () => {
      const document = await getLibraryCapture(id);
      if (!document) throw new Error('This capture no longer exists.');
      const loaded = await Promise.all(
        document.screenshots.map(async shot => {
          const blob = await getLibraryAsset(shot.previewAssetId);
          if (!blob) throw new Error('A saved screenshot is missing.');
          const url = URL.createObjectURL(blob);
          urls.push(url);
          if (cancelled) URL.revokeObjectURL(url);
          return { id: shot.id, blob, url, included: true, masks: [] };
        }),
      );
      if (cancelled) return;
      setCapture(document);
      setImages(loaded);
      setFields(previous => ({ ...previous, title: document.title }));
      try {
        const saved = readReportDraftSnapshot(localStorage, document);
        draftToken.current = saved.token;
        setDraft(saved.result);
      } catch {
        setError('Saved drafts are unavailable. You can still compose and export this report.');
      }
    })().catch(cause => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not open evidence.');
    });
    return () => {
      cancelled = true;
      urls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [id]);
  useEffect(() => {
    if (!capture) return;
    const changed = (event: StorageEvent) => {
      if (event.storageArea !== localStorage || (event.key !== draftKey(id) && event.key !== null)) return;
      try {
        const saved = readReportDraftSnapshot(localStorage, capture);
        if (saved.token === draftToken.current) return;
        setDraft(saved.result);
        setDraftConflict(true);
        setDirty(true);
        setStatus('');
      } catch {
        setError('The saved draft could not be checked. Your current report remains open.');
        setDirty(true);
      }
    };
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, [capture, id]);
  const records = capture?.diagnostics.map(sanitizeRecord) ?? [];
  const included = images.filter(image => image.included);
  const findings = sensitiveFindings(JSON.stringify({ fields, diagnostics: capture?.diagnostics }));
  const run = async (task: () => Promise<void>) => {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setError('');
    setStatus('');
    try {
      await task();
    } catch (cause) {
      if (cause instanceof ReportDraftConflictError) {
        setDraftConflict(true);
        setDirty(true);
        try {
          if (capture) setDraft(readReportDraftSnapshot(localStorage, capture).result);
        } catch {
          // Preserve the open report even when storage becomes unavailable during recovery.
        }
      }
      setError(cause instanceof Error ? cause.message : 'Could not export. Try again.');
    } finally {
      operation.current = false;
      setBusy(false);
    }
  };
  const updateImage = (index: number, patch: Partial<ShareImage>) => {
    setImages(previous => previous.map((image, position) => (position === index ? { ...image, ...patch } : image)));
    setReviewed(false);
    setDirty(true);
  };
  const applyTemplate = () => {
    setFields(previous => applyReportTemplate(previous, template));
    setReviewed(false);
    setDirty(true);
    setReplaceTemplate(false);
    setStatus(`${reportTemplates[template].label} template applied.`);
  };
  const saveDraft = async (replace = false) => {
    if (!capture) return;
    await withReportDraftLock(id, async () => {
      const latest = await getLibraryCapture(id);
      if (!latest || latest.revision !== capture.revision)
        throw new Error('This capture changed. Reload it before saving a report draft.');
      const expected = replace ? readReportDraftSnapshot(localStorage, capture).token : draftToken.current;
      const saved = saveReportDraft(localStorage, capture, fields, images, selected, expected);
      draftToken.current = JSON.stringify(saved);
      setDraft({ status: 'ready', draft: saved });
      setDraftConflict(false);
      setDirty(false);
      setStatus('Report draft saved on this device.');
    });
  };
  const restoreDraft = async () => {
    if (!capture) return;
    await withReportDraftLock(id, async () => {
      const latest = await getLibraryCapture(id);
      if (!latest || latest.revision !== capture.revision)
        throw new Error('This capture changed. Reload it before restoring a report draft.');
      const snapshot = readReportDraftSnapshot(localStorage, latest);
      const saved = snapshot.result;
      setDraft(saved);
      if (saved.status !== 'ready')
        throw new Error('This draft cannot be restored. The saved evidence may have changed.');
      setFields(saved.draft.fields);
      setImages(previous =>
        previous.map((image, index) => ({
          ...image,
          included: saved.draft.images[index]!.included,
          masks: saved.draft.images[index]!.masks,
        })),
      );
      setSelected(saved.draft.selected);
      draftToken.current = snapshot.token;
      setDraftConflict(false);
      setReviewed(false);
      setDirty(false);
      setStatus('Draft restored. Review the selected evidence again before exporting.');
    });
  };
  return (
    <>
      <a className="library-back" href={`?capture=${encodeURIComponent(id)}`}>
        ← Back to capture
      </a>
      <p className="library-eyebrow">PREPARE EVIDENCE TO SHARE</p>
      <h1>Review &amp; compose report</h1>
      <p className="library-muted">
        Draw over private image content to cover it with solid masks. Only selected evidence is exported. Your saved
        originals stay on this device.
      </p>
      {error && (
        <p role="alert" className="library-error">
          {error}
        </p>
      )}
      {!capture ? (
        !error && <p role="status">Opening evidence…</p>
      ) : (
        <fieldset className="review-layout review-fieldset" disabled={busy}>
          <section className="workspace-panel" aria-label="Review screenshots">
            <h2>1. Review screenshots</h2>
            <p className="library-muted">
              Drag on an image to add a mask, or use its keyboard controls. Automatic checks cannot inspect image
              pixels.
            </p>
            {images.map((image, index) => (
              <div key={image.id} className="review-shot">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={image.included}
                    onChange={event => updateImage(index, { included: event.target.checked })}
                  />
                  Include screenshot {index + 1}
                </label>
                <MaskImage image={image} index={index} change={masks => updateImage(index, { masks })} />
              </div>
            ))}
          </section>
          <div className="workspace-stack">
            <section className="workspace-panel">
              <h2>2. Compose your bug report</h2>
              <section aria-label="Report draft">
                <p className="library-muted">Save report text and evidence choices on this device to continue later.</p>
                {draft.status === 'ready' && <p>Local draft saved {new Date(draft.draft.savedAt).toLocaleString()}.</p>}
                {draftConflict && (
                  <p role="alert">The saved draft changed in another tab. Your current report is still open.</p>
                )}
                {(draft.status === 'stale' || draft.status === 'invalid') && (
                  <p role="alert">
                    {draft.status === 'stale'
                      ? 'The saved draft refers to an older capture. Discard it and review the current evidence.'
                      : 'The saved draft could not be read. Discard it to start a new draft.'}
                  </p>
                )}
                <div className="workspace-actions">
                  <button type="button" onClick={() => void run(() => saveDraft())}>
                    Save draft
                  </button>
                  {draftConflict && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!window.confirm('Replace the saved draft from another tab with your current report?'))
                          return;
                        void run(() => saveDraft(true));
                      }}>
                      Replace saved draft
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={draft.status !== 'ready'}
                    onClick={() => {
                      if (dirty && !window.confirm('Replace your unsaved report with the saved draft?')) return;
                      void run(restoreDraft);
                    }}>
                    Restore draft
                  </button>
                  <button
                    type="button"
                    disabled={draft.status === 'missing'}
                    onClick={() =>
                      void run(() =>
                        withReportDraftLock(id, () => {
                          discardReportDraft(localStorage, id, draftToken.current);
                          draftToken.current = null;
                          setDraft({ status: 'missing' });
                          setDraftConflict(false);
                          setDirty(true);
                          setStatus('Saved draft discarded. Your current report remains open.');
                        }),
                      )
                    }>
                    Discard saved draft
                  </button>
                </div>
              </section>
              <label>
                Report template
                <select
                  aria-label="Report template"
                  value={template}
                  onChange={event => {
                    setTemplate(event.target.value as ReportTemplate);
                    setReplaceTemplate(false);
                  }}>
                  {Object.entries(reportTemplates).map(([value, item]) => (
                    <option value={value} key={value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => {
                  if (fields.steps || fields.expected || fields.actual) setReplaceTemplate(true);
                  else applyTemplate();
                }}>
                Apply template
              </button>
              {replaceTemplate && (
                <div role="group" aria-label="Replace report text" className="library-confirm">
                  <p>Replace steps, expected behavior, and actual behavior with this template?</p>
                  <button type="button" onClick={applyTemplate}>
                    Replace report text
                  </button>
                  <button type="button" onClick={() => setReplaceTemplate(false)}>
                    Keep current text
                  </button>
                </div>
              )}
              <label>
                Severity
                <select
                  aria-label="Severity"
                  value={fields.severity ?? ''}
                  onChange={event => {
                    setFields(previous => ({ ...previous, severity: event.target.value as ReportFields['severity'] }));
                    setReviewed(false);
                    setDirty(true);
                  }}>
                  {severityValues.map(value => (
                    <option key={value} value={value}>
                      {value ? value[0]!.toUpperCase() + value.slice(1) : 'Not specified'}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Environment
                <textarea
                  rows={2}
                  maxLength={10_000}
                  aria-label="Environment"
                  placeholder="Browser, operating system, app version, device…"
                  value={fields.environment ?? ''}
                  onChange={event => {
                    setFields(previous => ({ ...previous, environment: event.target.value }));
                    setReviewed(false);
                    setDirty(true);
                  }}
                />
              </label>
              {(['title', 'steps', 'expected', 'actual'] as const).map(key => (
                <label key={key}>
                  {
                    {
                      title: 'Report title',
                      steps: 'Steps to reproduce',
                      expected: 'Expected behavior',
                      actual: 'Actual behavior',
                    }[key]
                  }
                  <textarea
                    aria-label={
                      {
                        title: 'Report title',
                        steps: 'Steps to reproduce',
                        expected: 'Expected behavior',
                        actual: 'Actual behavior',
                      }[key]
                    }
                    rows={key === 'title' ? 2 : 3}
                    maxLength={10_000}
                    value={fields[key]}
                    onChange={event => {
                      setFields(previous => ({ ...previous, [key]: event.target.value }));
                      setReviewed(false);
                      setDirty(true);
                    }}
                  />
                </label>
              ))}
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={Boolean(fields.sourceUrl)}
                  onChange={event => {
                    setFields(previous => ({ ...previous, sourceUrl: event.target.checked ? capture.source.url : '' }));
                    setReviewed(false);
                    setDirty(true);
                  }}
                />
                Include source URL
              </label>
              {fields.sourceUrl && <p className="evidence-json">{fields.sourceUrl}</p>}
            </section>
            <section className="workspace-panel">
              <h2>3. Select diagnostics</h2>
              <p className="library-muted">
                Diagnostics start excluded. Recognized credentials and email addresses are redacted in previews and
                exports.
              </p>
              {findings.length > 0 && (
                <p role="status">Detected: {findings.join(', ')}. Review the selected records and text.</p>
              )}
              {!records.length && <p className="library-muted">No diagnostics were saved with this capture.</p>}
              {records.map((record, index) => (
                <details key={index}>
                  <summary>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={selected.includes(index)}
                        onChange={event => {
                          setSelected(previous =>
                            event.target.checked ? [...previous, index] : previous.filter(value => value !== index),
                          );
                          setReviewed(false);
                          setDirty(true);
                        }}
                      />
                      Include diagnostic {index + 1}
                    </label>
                  </summary>
                  <pre className="evidence-json">{JSON.stringify(record, null, 2)}</pre>
                </details>
              ))}
            </section>
            <section className="workspace-panel">
              <h2>4. Export reviewed evidence</h2>
              <p>
                {included.length} images · {selected.length} diagnostic records
              </p>
              <details>
                <summary>Preview report text</summary>
                <pre className="evidence-json">{reportMarkdown(fields, included.length)}</pre>
              </details>
              <label className="checkbox-label">
                <input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} />I have
                reviewed the selected evidence
              </label>
              <div className="workspace-actions">
                <button
                  className="library-primary"
                  disabled={!reviewed || busy || !fields.title.trim()}
                  onClick={() =>
                    void run(async () => {
                      const blob = await buildReviewedZip(
                        fields,
                        included,
                        selected.map(index => records[index]),
                      );
                      downloadBlob(blob, 'reviewed-bug-report.zip');
                      setStatus('Reviewed ZIP prepared.');
                      setDirty(false);
                    })
                  }>
                  Download reviewed ZIP
                </button>
                <button
                  disabled={!reviewed || busy || !fields.title.trim()}
                  onClick={() => {
                    downloadBlob(
                      new Blob(
                        [
                          reportJson(
                            fields,
                            included.length,
                            selected.map(index => records[index]),
                          ),
                        ],
                        {
                          type: 'application/json',
                        },
                      ),
                      'reviewed-report.json',
                    );
                    setStatus('Reviewed JSON prepared. Attachment names refer to the PNG files in the ZIP.');
                  }}>
                  Download reviewed JSON
                </button>
                <button
                  disabled={!reviewed || busy || !fields.title.trim()}
                  onClick={() => {
                    downloadBlob(
                      new Blob([reportMarkdown(fields, included.length)], { type: 'text/markdown' }),
                      'report.md',
                    );
                    setStatus('Markdown prepared. Its image links refer to the PNG files in the ZIP.');
                  }}>
                  Download Markdown
                </button>
                <button
                  disabled={!reviewed || busy}
                  onClick={() =>
                    void run(async () => {
                      await navigator.clipboard.writeText(reportMarkdown(fields, included.length));
                      setStatus('Reviewed report copied.');
                    })
                  }>
                  Copy report
                </button>
                {included.map((image, index) => (
                  <button
                    key={image.id}
                    disabled={!reviewed || busy}
                    onClick={() =>
                      void run(async () =>
                        downloadBlob(await flattenImage(image.blob, image.masks), `screenshot-${index + 1}.png`),
                      )
                    }>
                    Download reviewed image {index + 1}
                  </button>
                ))}
              </div>
              <p role="status">{busy ? 'Working on report…' : status}</p>
              {dirty && <p className="library-muted">Unsaved report changes</p>}
            </section>
          </div>
        </fieldset>
      )}
    </>
  );
};

export default SharePage;
