import { useEffect, useRef, useState } from 'react';

import type { CaptureDocument } from '@extension/shared';
import { getLibraryAsset, getLibraryCapture, saveLibraryText } from '@extension/storage';

const ScreenshotText = ({
  capture,
  updated,
}: {
  capture: CaptureDocument;
  updated: (value: CaptureDocument) => void;
}) => {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const active = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      active.current?.abort();
    },
    [],
  );
  const readText = async () => {
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError('');
    try {
      const { recognizeImages } = await import('./ocr');
      const blobs = await Promise.all(
        capture.screenshots.map(async shot => {
          const blob = await getLibraryAsset(shot.previewAssetId);
          if (!blob) throw new Error('A saved screenshot is missing.');
          return blob;
        }),
      );
      if (controller.signal.aborted) return;
      const texts = await recognizeImages(blobs, setStatus, controller.signal);
      if (controller.signal.aborted) return;
      await saveLibraryText(
        capture.id,
        capture.revision,
        capture.screenshots.map((shot, index) => ({
          id: shot.id,
          previewAssetId: shot.previewAssetId,
          text: texts[index]!,
        })),
      );
      const saved = await getLibraryCapture(capture.id);
      if (saved) updated(saved);
      setStatus('Text saved locally and added to library search.');
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not recognize text.');
    } finally {
      if (active.current === controller) {
        active.current = null;
        setBusy(false);
        if (controller.signal.aborted) setStatus('Text recognition cancelled.');
      }
    }
  };
  return (
    <section className="workspace-panel screenshot-text" aria-label="Screenshot text">
      <h2>Search text inside screenshots</h2>
      <p className="library-muted">
        Read English text from saved, annotated images. Processing stays on this device. Text is stored until you clear
        it or edit the images.
      </p>
      <div className="workspace-actions">
        <button disabled={busy} onClick={() => void readText()}>
          Read screenshot text
        </button>
        {busy && <button onClick={() => active.current?.abort()}>Cancel text recognition</button>}
        <button
          disabled={busy || !capture.screenshotText?.length}
          onClick={() => {
            void saveLibraryText(capture.id, capture.revision, [])
              .then(async () => {
                const saved = await getLibraryCapture(capture.id);
                if (saved) updated(saved);
                setStatus('Saved text cleared.');
              })
              .catch(cause => setError(String(cause)));
          }}>
          Clear saved text
        </button>
      </div>
      {error && (
        <p role="alert" className="library-error">
          {error}
        </p>
      )}
      <p role="status">{status}</p>
      {capture.screenshotText?.map((entry, index) => (
        <div key={entry.id}>
          <label>
            Text from screenshot {index + 1}
            <textarea
              aria-label={`Text from screenshot ${index + 1}`}
              rows={5}
              readOnly
              value={entry.text || 'No text found.'}
            />
          </label>
          <button
            onClick={() =>
              void navigator.clipboard
                .writeText(entry.text)
                .then(() => setStatus('Text copied.'))
                .catch(() => setError('Could not copy. Select the text and copy it manually.'))
            }>
            Copy screenshot {index + 1} text
          </button>
        </div>
      ))}
    </section>
  );
};

export { ScreenshotText };
