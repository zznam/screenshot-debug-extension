import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';

import { useStorage } from '@extension/shared';
import type { CaptureSummary } from '@extension/shared';
import { librarySettingsStorage, listLibraryCaptures, themeStorage } from '@extension/storage';

import { CaptureDetail } from './capture-detail';
import { filterCaptures, formatBytes } from './filter';
import type { LibraryFilters } from './filter';
import { LibraryShortcuts } from './library-shortcuts';
import { PAGE_SIZE, emptyFilters, libraryQuery, readLibraryView, sortCaptures } from './library-view';
import type { SortOrder } from './library-view';
import { SavedViewsPanel } from './saved-views-panel';

const ScreenshotEditorPage = lazy(() => import('./screenshot-editor'));
const SharePage = lazy(() => import('./share-page'));
const ComparePage = lazy(() => import('./compare-page'));
const StoragePage = lazy(() => import('./storage-page'));

const initialView = readLibraryView(window.location.search);

const LibraryPage = () => {
  const theme = useStorage(themeStorage);
  const saveMode = useStorage(librarySettingsStorage);
  const [captures, setCaptures] = useState<CaptureSummary[]>([]);
  const [filters, setFilters] = useState(initialView.filters);
  const [sort, setSort] = useState<SortOrder>(initialView.sort);
  const [page, setPage] = useState(initialView.page);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const captureId = new URLSearchParams(window.location.search).get('capture');
  const params = new URLSearchParams(window.location.search);
  const compareId = params.get('compare');
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
  const visible = useMemo(() => sortCaptures(filterCaptures(captures, filters), sort), [captures, filters, sort]);
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageCaptures = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const invalidDates = Boolean(filters.from && filters.to && filters.from > filters.to);
  const listView = !captureId && compareId === null && !params.has('storage');
  useEffect(() => {
    if (!listView || loading) return;
    const query = libraryQuery(filters, sort, currentPage);
    window.history.replaceState(null, '', `index.html${query}`);
    try {
      sessionStorage.setItem('library-view', query);
    } catch {
      /* Browsing still works when storage is unavailable. */
    }
  }, [filters, sort, currentPage, listView, loading]);
  const domains = [...new Set(captures.map(capture => capture.source.domain))].sort();
  const tags = [...new Set(captures.flatMap(capture => capture.tags))].sort((a, b) => a.localeCompare(b));
  const updateFilter = (key: keyof LibraryFilters, value: string) => {
    setFilters(previous => ({ ...previous, [key]: value }));
    setPage(1);
  };
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
        <a href="?storage=1" className="library-local">
          Storage &amp; cleanup
        </a>
        <span className="library-local">
          <span aria-hidden="true">●</span> On this device
        </span>
      </header>
      <main className="library-main">
        {params.has('storage') ? (
          <Suspense fallback={<p role="status">Opening storage…</p>}>
            <StoragePage />
          </Suspense>
        ) : compareId !== null ? (
          <Suspense fallback={<p role="status">Opening comparison…</p>}>
            <ComparePage initialId={compareId} />
          </Suspense>
        ) : captureId && params.has('share') ? (
          <Suspense fallback={<p role="status">Opening review…</p>}>
            <SharePage id={captureId} />
          </Suspense>
        ) : captureId ? (
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
                  placeholder="Title, domain, tag, notes, or screenshot text…"
                  value={filters.search}
                  onChange={event => updateFilter('search', event.target.value)}
                />
              </label>
              <label>
                Domain
                <select
                  aria-label="Domain"
                  value={filters.domain}
                  onChange={event => updateFilter('domain', event.target.value)}>
                  <option value="">All domains</option>
                  {filters.domain && !domains.includes(filters.domain) && (
                    <option value={filters.domain}>{filters.domain} (no current captures)</option>
                  )}
                  {domains.map(domain => (
                    <option key={domain}>{domain}</option>
                  ))}
                </select>
              </label>
              <label>
                Type
                <select
                  aria-label="Type"
                  value={filters.kind}
                  onChange={event => updateFilter('kind', event.target.value)}>
                  <option value="">All types</option>
                  <option value="screenshots">Screenshots</option>
                </select>
              </label>
              <label>
                Tag
                <select
                  aria-label="Tag"
                  value={filters.tag ?? ''}
                  onChange={event => updateFilter('tag', event.target.value)}>
                  <option value="">All tags</option>
                  {filters.tag && !tags.includes(filters.tag) && (
                    <option value={filters.tag}>{filters.tag} (no current captures)</option>
                  )}
                  {tags.map(tag => (
                    <option key={tag}>{tag}</option>
                  ))}
                </select>
              </label>
              <label>
                Favorites
                <select
                  aria-label="Favorites"
                  value={filters.favorite ?? ''}
                  onChange={event => updateFilter('favorite', event.target.value)}>
                  <option value="">All captures</option>
                  <option value="only">Favorites only</option>
                </select>
              </label>
              <label>
                Status
                <select
                  aria-label="Status"
                  value={filters.status ?? ''}
                  onChange={event => updateFilter('status', event.target.value)}>
                  <option value="">All statuses</option>
                  <option value="open">Open</option>
                  <option value="in-progress">In progress</option>
                  <option value="resolved">Resolved</option>
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
            <SavedViewsPanel
              view={{ filters, sort, page: currentPage }}
              apply={view => {
                setFilters(view.filters);
                setSort(view.sort);
                setPage(1);
              }}
            />
            <LibraryShortcuts />
            {invalidDates && (
              <p className="library-error" role="alert">
                Choose an end date on or after the start date.
              </p>
            )}
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
                  <span role="status" aria-live="polite">
                    {visible.length} {visible.length === 1 ? 'capture' : 'captures'}
                  </span>
                  <button
                    className="library-text-button"
                    onClick={() => {
                      setFilters(emptyFilters);
                      setPage(1);
                    }}>
                    Clear filters
                  </button>
                  <label className="library-sort">
                    Sort captures
                    <select
                      aria-label="Sort captures"
                      value={sort}
                      onChange={event => {
                        setSort(event.target.value as SortOrder);
                        setPage(1);
                      }}>
                      <option value="newest">Newest first</option>
                      <option value="oldest">Oldest first</option>
                      <option value="title">Title A–Z</option>
                      <option value="size">Largest first</option>
                    </select>
                  </label>
                  <a href="?compare=">Compare screenshots</a>
                </div>
                {pageCount > 1 && (
                  <nav className="library-pagination" aria-label="Capture pages">
                    <button disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
                      Previous page
                    </button>
                    <span role="status">
                      Page {currentPage} of {pageCount} · {visible.length} captures
                    </span>
                    <button disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>
                      Next page
                    </button>
                  </nav>
                )}
                {visible.length ? (
                  <div className="library-grid">
                    {pageCaptures.map(capture => (
                      <a className="library-card" key={capture.id} href={`?capture=${encodeURIComponent(capture.id)}`}>
                        <div className="library-thumbnail">
                          <img src={capture.thumbnail} alt="" loading="lazy" />
                          <span>
                            {capture.screenshotCount} {capture.screenshotCount === 1 ? 'image' : 'images'}
                          </span>
                        </div>
                        <div className="library-card-body">
                          <p className="library-eyebrow">{capture.source.domain}</p>
                          <h2>
                            {capture.favorite && <span aria-label="Favorite">★ </span>}
                            {capture.title}
                          </h2>
                          <p className="library-muted">
                            {
                              { open: 'Open', 'in-progress': 'In progress', resolved: 'Resolved' }[
                                capture.workflowStatus ?? 'open'
                              ]
                            }
                          </p>
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
