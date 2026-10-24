import { useEffect, useRef, useState } from 'react';

import { useUnsavedChanges } from '@extension/shared';
import type { CaptureDocument } from '@extension/shared';
import { deleteLibraryCapture, getLibraryAsset, getLibraryCapture, updateLibraryMetadata } from '@extension/storage';

import { formatBytes } from './filter';
import { libraryHome } from './library-view';
import { ScreenshotText } from './screenshot-text';

const CaptureDetail = ({ id }: { id: string }) => {
  const [capture, setCapture] = useState<CaptureDocument>();
  const [images, setImages] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const operation = useRef(false);
  const dirty = Boolean(capture && (title !== capture.title || tags !== capture.tags.join(', ')));
  const allowNavigation = useUnsavedChanges(dirty || busy);
  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    void (async () => {
      const document = await getLibraryCapture(id);
      if (!document) throw new Error('This capture no longer exists.');
      if (cancelled) return;
      setCapture(document);
      setTitle(document.title);
      setTags(document.tags.join(', '));
      for (const screenshot of document.screenshots) {
        const blob = await getLibraryAsset(screenshot.previewAssetId);
        if (cancelled) return;
        if (!blob) throw new Error('A saved image is missing.');
        urls.push(URL.createObjectURL(blob));
      }
      setImages([...urls]);
    })().catch(cause => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not open this capture.');
    });
    return () => {
      cancelled = true;
      urls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [id]);
  const save = async () => {
    if (!capture || operation.current) return;
    operation.current = true;
    setBusy(true);
    setError('');
    setStatus('');
    try {
      await updateLibraryMetadata(id, capture.revision, title, tags.split(','));
      const updated = await getLibraryCapture(id);
      if (!updated) throw new Error('This capture no longer exists.');
      setCapture(updated);
      setTitle(updated.title);
      setTags(updated.tags.join(', '));
      setStatus('Changes saved.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save changes.');
    } finally {
      operation.current = false;
      setBusy(false);
    }
  };
  const remove = async () => {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setError('');
    try {
      await deleteLibraryCapture(id);
      allowNavigation();
      window.location.href = libraryHome();
    } catch (cause) {
      operation.current = false;
      setError(cause instanceof Error ? cause.message : 'Could not delete this capture.');
      setBusy(false);
    }
  };
  return (
    <>
      <a className="library-back" href={libraryHome()}>
        ← All captures
      </a>
      {error && (
        <p role="alert" className="library-error">
          {error}
        </p>
      )}
      {capture ? (
        <div className="library-detail">
          <section className="library-evidence" aria-label="Saved screenshots">
            {images.map((url, index) => (
              <figure key={url}>
                <img src={url} alt={`${capture.title}, screenshot ${index + 1}`} />
                <figcaption>Screenshot {index + 1} · saved annotations included</figcaption>
              </figure>
            ))}
          </section>
          <aside className="library-properties">
            <p className="library-eyebrow">SAVED ON THIS DEVICE</p>
            <h1>{capture.title}</h1>
            <p className="library-muted">
              {capture.source.domain} · {new Date(capture.createdAt).toLocaleString()}
            </p>
            <a className="library-primary library-edit-link" href={`?capture=${encodeURIComponent(id)}&edit=1`}>
              Edit screenshots
            </a>
            <a className="library-primary library-edit-link" href={`?capture=${encodeURIComponent(id)}&share=1`}>
              Review &amp; compose report
            </a>
            <a className="library-edit-link" href={`?compare=${encodeURIComponent(id)}`}>
              Compare screenshots
            </a>
            <form
              onSubmit={event => {
                event.preventDefault();
                void save();
              }}>
              <label>
                Title
                <input
                  value={title}
                  maxLength={500}
                  disabled={busy}
                  onChange={event => {
                    setTitle(event.target.value);
                    setStatus('');
                  }}
                  required
                />
              </label>
              <label>
                Tags
                <input
                  value={tags}
                  disabled={busy}
                  onChange={event => {
                    setTags(event.target.value);
                    setStatus('');
                  }}
                  placeholder="checkout, mobile, bug"
                />
              </label>
              <p className="library-muted">Separate tags with commas.</p>
              <button className="library-primary" disabled={busy || !dirty || !title.trim()} type="submit">
                {busy ? 'Saving…' : 'Save details'}
              </button>
            </form>
            <p role="status">{dirty ? 'Unsaved changes' : status}</p>
            <dl className="library-facts">
              <div>
                <dt>Images</dt>
                <dd>{capture.screenshots.length}</dd>
              </div>
              <div>
                <dt>Diagnostic records</dt>
                <dd>{capture.diagnostics.length}</dd>
              </div>
              <div>
                <dt>Local size</dt>
                <dd>{formatBytes(capture.sizeBytes)}</dd>
              </div>
              <div>
                <dt>Revision</dt>
                <dd>{capture.revision}</dd>
              </div>
            </dl>
            <p className="library-muted">Original images and annotation layers are preserved on this device.</p>
            <button className="library-danger" onClick={() => setDeleting(true)} disabled={busy}>
              Delete capture
            </button>
            {deleting && (
              <div className="library-confirm" role="group" aria-label="Confirm deletion">
                <p>Delete this capture and its images permanently?</p>
                <button className="library-danger" disabled={busy} onClick={() => void remove()}>
                  Delete permanently
                </button>
                <button disabled={busy} onClick={() => setDeleting(false)}>
                  Keep capture
                </button>
              </div>
            )}
          </aside>
        </div>
      ) : (
        !error && <p role="status">Opening capture…</p>
      )}
      {capture && <ScreenshotText capture={capture} updated={setCapture} />}
    </>
  );
};

export { CaptureDetail };
