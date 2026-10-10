import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';

import { useStorage } from '@extension/shared';
import type { CaptureSummary } from '@extension/shared';
import { librarySettingsStorage, listLibraryCaptures, themeStorage } from '@extension/storage';

import { CaptureDetail } from './capture-detail';
import { filterCaptures, formatBytes } from './filter';
import type { LibraryFilters } from './filter';

const ScreenshotEditorPage = lazy(() => import('./screenshot-editor'));

const emptyFilters: LibraryFilters = { search: '', domain: '', from: '', to: '', kind: '' };

const LibraryPage = () => {
  const theme = useStorage(themeStorage);
  const saveMode = useStorage(librarySettingsStorage);
  const [captures, setCaptures] = useState<CaptureSummary[]>([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const captureId = new URLSearchParams(window.location.search).get('capture');
  const refresh = useCallback(async () => {
    try {
      setCaptures(await listLibraryCaptures());
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load the library.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
  }, [theme]);
  useEffect(() => {
    void refresh();
    const channel = new BroadcastChannel('capture-library');
    channel.onmessage = () => void refresh();
    window.addEventListener('focus', refresh);
    return () => {
      channel.close();
      window.removeEventListener('focus', refresh);
    };
  }, [refresh]);
  const visible = useMemo(() => filterCaptures(captures, filters), [captures, filters]);
  const domains = [...new Set(captures.map(capture => capture.source.domain))].sort();
  const updateFilter = (key: keyof LibraryFilters, value: string) =>
    setFilters(previous => ({ ...previous, [key]: value }));
  if (captureId && new URLSearchParams(window.location.search).has('edit')) {
    return (
      <Suspense fallback={<p role="status">Opening editor…</p>}>
        <ScreenshotEditorPage id={captureId} theme={theme} />
      </Suspense>
    );
  }
  return (
    <div className="library-shell">
      <header className="library-topbar">
        <a href="index.html" className="library-brand">
          <img src="../logo.png" alt="" width="36" height="36" />
          <span>Screenshot &amp; Debug</span>
        </a>
        <span className="library-local">
          <span aria-hidden="true">●</span> On this device
        </span>
      </header>
      <main className="library-main">
        {captureId ? (
          <CaptureDetail id={captureId} />
        ) : (
          <>
            <div className="library-heading">
              <div>
                <p className="library-eyebrow">YOUR LOCAL WORKSPACE</p>
                <h1>Capture library</h1>
                <p className="library-muted">Keep the evidence. Pick up where you left off.</p>
              </div>
              <div className="library-totals">
                <strong>{captures.length}</strong> saved {captures.length === 1 ? 'capture' : 'captures'}
                <span>
                  {formatBytes(captures.reduce((total, capture) => total + capture.sizeBytes, 0))} on this device
                </span>
              </div>
            </div>
            {saveMode === 'ask' && (
              <section className="library-onboarding" aria-label="Choose saving preference">
                <div>
                  <strong>Choose what to keep</strong>
                  <p>
                    Save captures yourself, or keep completed captures automatically. Change this anytime in Settings.
                  </p>
                </div>
                <div>
                  <button
                    onClick={() =>
                      void librarySettingsStorage.set('manual').catch(() => setError('Could not save preference.'))
                    }>
                    Save manually
                  </button>
                  <button
                    className="library-primary"
                    onClick={() =>
                      void librarySettingsStorage.set('automatic').catch(() => setError('Could not save preference.'))
                    }>
                    Save automatically
                  </button>
                </div>
              </section>
            )}
            <section className="library-filters" aria-label="Filter captures">
              <label className="library-search">
                Search
                <input
                  type="search"
                  placeholder="Title, domain, or tag…"
                  value={filters.search}
                  onChange={event => updateFilter('search', event.target.value)}
                />
              </label>
              <label>
                Domain
                <select value={filters.domain} onChange={event => updateFilter('domain', event.target.value)}>
                  <option value="">All domains</option>
                  {domains.map(domain => (
                    <option key={domain}>{domain}</option>
                  ))}
                </select>
              </label>
              <label>
                Type
                <select value={filters.kind} onChange={event => updateFilter('kind', event.target.value)}>
                  <option value="">All types</option>
                  <option value="screenshots">Screenshots</option>
                </select>
              </label>
              <label>
                From
                <input type="date" value={filters.from} onChange={event => updateFilter('from', event.target.value)} />
              </label>
              <label>
                To
                <input type="date" value={filters.to} onChange={event => updateFilter('to', event.target.value)} />
              </label>
            </section>
            {error && (
              <p role="alert" className="library-error">
                {error} <button onClick={() => void refresh()}>Retry</button>
              </p>
            )}
            {loading ? (
              <p role="status">Loading captures…</p>
            ) : (
              <>
                <div className="library-results">
                  <span>
                    {visible.length} {visible.length === 1 ? 'capture' : 'captures'}
                  </span>
                  <button className="library-text-button" onClick={() => setFilters(emptyFilters)}>
                    Clear filters
                  </button>
                </div>
                {visible.length ? (
                  <div className="library-grid">
                    {visible.map(capture => (
                      <a className="library-card" key={capture.id} href={`?capture=${encodeURIComponent(capture.id)}`}>
                        <div className="library-thumbnail">
                          <img src={capture.thumbnail} alt="" loading="lazy" />
                          <span>
                            {capture.screenshotCount} {capture.screenshotCount === 1 ? 'image' : 'images'}
                          </span>
                        </div>
                        <div className="library-card-body">
                          <p className="library-eyebrow">{capture.source.domain}</p>
                          <h2>{capture.title}</h2>
                          <p className="library-muted">
                            {new Date(capture.createdAt).toLocaleDateString()} · {formatBytes(capture.sizeBytes)}
                          </p>
                          <div className="library-tags">
                            {capture.tags.map(tag => (
                              <span key={tag}>{tag}</span>
                            ))}
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <section className="library-empty">
                    <span aria-hidden="true" className="library-empty-icon">
                      ▧
                    </span>
                    <h2>{captures.length ? 'No matching captures' : 'Your next capture belongs here'}</h2>
                    <p>
                      {captures.length
                        ? 'Try another search or clear your filters.'
                        : 'Capture a page from the extension, then choose Save to library. Everything stays on this device.'}
                    </p>
                  </section>
                )}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export { LibraryPage };
