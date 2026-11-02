import { useEffect, useState } from 'react';

import type { CaptureDocument, CaptureSummary } from '@extension/shared';
import { getLibraryAsset, getLibraryCapture, listLibraryCaptures } from '@extension/storage';

import { comparePixels, loadImage } from './image-tools';

interface ComparisonImage {
  url: string;
  width: number;
  height: number;
}
const ComparePage = ({ initialId }: { initialId: string }) => {
  const [captures, setCaptures] = useState<CaptureSummary[]>([]);
  const [ids, setIds] = useState([initialId, '']);
  const [documents, setDocuments] = useState<(CaptureDocument | undefined)[]>([]);
  const [shots, setShots] = useState([0, 0]);
  const [images, setImages] = useState<ComparisonImage[]>([]);
  const [difference, setDifference] = useState('');
  const [percent, setPercent] = useState<number | null>(null);
  const [position, setPosition] = useState(50);
  const [mode, setMode] = useState('slider');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void listLibraryCaptures()
      .then(items => {
        if (!cancelled) setCaptures(items);
      })
      .catch(cause => {
        if (!cancelled) setError(String(cause));
      });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    setDocuments([]);
    setImages([]);
    setDifference('');
    setError('');
    if (!ids[0] || !ids[1]) return;
    void Promise.all(ids.map(id => getLibraryCapture(id!)))
      .then(items => {
        if (cancelled) return;
        if (items.some(item => !item)) throw new Error('A selected capture was deleted. Choose another capture.');
        setDocuments(items);
      })
      .catch(cause => {
        if (!cancelled) setError(String(cause));
      });
    return () => {
      cancelled = true;
    };
  }, [ids]);
  useEffect(() => {
    if (documents.length !== 2) return;
    let cancelled = false;
    const urls: string[] = [];
    setLoading(true);
    setImages([]);
    setDifference('');
    setPercent(null);
    setError('');
    void (async () => {
      const outcomes = await Promise.allSettled(
        documents.map(async (document, index) => {
          const shot = document!.screenshots[shots[index] ?? 0];
          if (!shot) throw new Error('Choose a screenshot from each capture.');
          const blob = await getLibraryAsset(shot.previewAssetId);
          if (!blob) throw new Error('A selected screenshot is missing.');
          const bitmap = await loadImage(blob);
          const url = URL.createObjectURL(blob);
          urls.push(url);
          if (cancelled) URL.revokeObjectURL(url);
          return { bitmap, url, width: bitmap.width, height: bitmap.height };
        }),
      );
      const loaded = outcomes.flatMap(outcome => (outcome.status === 'fulfilled' ? [outcome.value] : []));
      try {
        const failed = outcomes.find(outcome => outcome.status === 'rejected');
        if (failed?.status === 'rejected') throw failed.reason;
        if (cancelled) return;
        setImages(loaded.map(({ url, width, height }) => ({ url, width, height })));
        if (loaded[0]!.width !== loaded[1]!.width || loaded[0]!.height !== loaded[1]!.height) {
          setMode('side');
          return;
        }
        // Bound work for very long full-page captures; report the sampling explicitly.
        const scale = Math.min(1, 1600 / Math.max(loaded[0]!.width, loaded[0]!.height));
        const width = Math.max(1, Math.round(loaded[0]!.width * scale));
        const height = Math.max(1, Math.round(loaded[0]!.height * scale));
        const layers = loaded.map(image => {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext('2d')!;
          context.drawImage(image.bitmap, 0, 0, width, height);
          return context.getImageData(0, 0, width, height).data;
        });
        const diff = comparePixels(layers[0]!, layers[1]!);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')!.putImageData(new ImageData(Uint8ClampedArray.from(diff.pixels), width, height), 0, 0);
        setDifference(canvas.toDataURL());
        setPercent(diff.percent);
      } finally {
        loaded.forEach(image => image.bitmap.close());
      }
    })()
      .catch(cause => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not compare screenshots.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      urls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [documents, shots]);
  const mismatch =
    images.length === 2 && (images[0]!.width !== images[1]!.width || images[0]!.height !== images[1]!.height);
  return (
    <>
      <a className="library-back" href="index.html">
        ← All captures
      </a>
      <p className="library-eyebrow">BEFORE &amp; AFTER</p>
      <h1>Compare screenshots</h1>
      <div className="comparison-selectors">
        {['Before', 'After'].map((label, index) => (
          <section className="workspace-panel" key={label}>
            <label>
              {label} capture
              <select
                aria-label={`${label} capture`}
                value={ids[index]}
                onChange={event => {
                  setIds(previous => previous.map((id, key) => (key === index ? event.target.value : id)));
                  setShots(previous => previous.map((shot, key) => (key === index ? 0 : shot)));
                }}>
                <option value="">Choose a capture</option>
                {captures.map(capture => (
                  <option key={capture.id} value={capture.id}>
                    {capture.title} · {new Date(capture.createdAt).toLocaleString()}
                  </option>
                ))}
              </select>
            </label>
            {documents[index] && (
              <>
                <label>
                  {label} screenshot
                  <select
                    aria-label={`${label} screenshot`}
                    value={shots[index]}
                    onChange={event =>
                      setShots(previous =>
                        previous.map((shot, key) => (key === index ? Number(event.target.value) : shot)),
                      )
                    }>
                    {documents[index]!.screenshots.map((shot, key) => (
                      <option key={shot.id} value={key}>
                        Screenshot {key + 1}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="library-muted">
                  {documents[index]!.source.domain} ·{' '}
                  {images[index] ? `${images[index]!.width} × ${images[index]!.height} pixels` : 'Loading image…'}
                </p>
              </>
            )}
          </section>
        ))}
      </div>
      {error && (
        <p role="alert" className="library-error">
          {error}
        </p>
      )}
      {loading && <p role="status">Comparing saved screenshots…</p>}
      {images.length === 2 && (
        <section className="workspace-panel">
          <div className="workspace-actions">
            <button aria-pressed={mode === 'side'} onClick={() => setMode('side')}>
              Side by side
            </button>
            <button aria-pressed={mode === 'slider'} disabled={mismatch} onClick={() => setMode('slider')}>
              Slider
            </button>
            <button aria-pressed={mode === 'diff'} disabled={!difference} onClick={() => setMode('diff')}>
              Highlight differences
            </button>
          </div>
          {mismatch && (
            <p role="status">
              Image dimensions differ. Side-by-side view preserves each image’s proportions; pixel comparison requires
              matching dimensions.
            </p>
          )}
          {percent !== null && (
            <p role="status">
              {percent.toFixed(2)}% of sampled pixels differ. Large images are sampled and small color variations are
              ignored.
            </p>
          )}
          {mode === 'side' ? (
            <div className="comparison-side">
              {images.map((image, index) => (
                <figure key={image.url}>
                  <figcaption>{index ? 'After' : 'Before'}</figcaption>
                  <img src={image.url} alt={`${index ? 'After' : 'Before'} screenshot`} />
                </figure>
              ))}
            </div>
          ) : mode === 'diff' ? (
            <img className="comparison-diff" src={difference} alt="Differences highlighted in pink" />
          ) : (
            <>
              <label>
                Comparison position
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={position}
                  onChange={event => setPosition(Number(event.target.value))}
                />
              </label>
              <div className="comparison-slider">
                <img src={images[0]!.url} alt="Before screenshot" />
                <img src={images[1]!.url} alt="After screenshot" style={{ clipPath: `inset(0 0 0 ${position}%)` }} />
                <span className="comparison-divider" style={{ left: `${position}%` }} />
              </div>
            </>
          )}
        </section>
      )}
      {!ids[1] && <p className="library-muted">Choose an after capture to compare saved, annotated images.</p>}
    </>
  );
};

export default ComparePage;
