import { useEffect, useState } from 'react';

import type { CaptureDocument } from '@extension/shared';
import { deleteLibraryCapture, getLibraryAsset, getLibraryCapture, updateLibraryMetadata } from '@extension/storage';

import { formatBytes } from './filter';

const CaptureDetail = ({ id }: { id: string }) => {
  const [capture, setCapture] = useState<CaptureDocument>();
  const [images, setImages] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
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
    if (!capture) return;
    setBusy(true);
    setError('');
    setStatus('');
    try {
      await updateLibraryMetadata(id, capture.revision, title, tags.split(','));
      const updated = await getLibraryCapture(id);
      setCapture(updated);
      setStatus('Changes saved.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save changes.');
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    setError('');
    try {
      await deleteLibraryCapture(id);
      window.location.href = 'index.html';
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete this capture.');
      setBusy(false);
    }
  };
  return (
    <>
      <a className="library-back" href="index.html">
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
            <form
              onSubmit={event => {
                event.preventDefault();
                void save();
              }}>
              <label>
                Title
                <input value={title} maxLength={500} onChange={event => setTitle(event.target.value)} required />
              </label>
              <label>
                Tags
                <input
                  value={tags}
                  onChange={event => setTags(event.target.value)}
                  placeholder="checkout, mobile, bug"
                />
              </label>
              <p className="library-muted">Separate tags with commas.</p>
              <button className="library-primary" disabled={busy} type="submit">
                Save details
              </button>
            </form>
            <p role="status">{status}</p>
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
    </>
  );
};

export { CaptureDetail };
