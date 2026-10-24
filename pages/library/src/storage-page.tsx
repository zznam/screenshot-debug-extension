import { useCallback, useEffect, useMemo, useState } from 'react';

import { deleteLibraryCaptures, listLibraryCaptures } from '@extension/storage';
import type { LibraryResponse, ManagedStorageEntry, StorageCategory } from '@extension/storage';

import { formatBytes } from './filter';

const categoryNames: Record<StorageCategory, string> = {
  captures: 'Captures',
  ai: 'AI sessions',
  diagnostics: 'Diagnostics',
};
const keyFor = (entry: ManagedStorageEntry) => `${entry.category}:${entry.id}`;
const StoragePage = () => {
  const [entries, setEntries] = useState<ManagedStorageEntry[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [category, setCategory] = useState('');
  const [query, setQuery] = useState('');
  const [before, setBefore] = useState('');
  const [minimum, setMinimum] = useState('');
  const [sort, setSort] = useState('size');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const refresh = useCallback(async () => {
    try {
      const [captures, response] = await Promise.all([
        listLibraryCaptures(),
        chrome.runtime.sendMessage({ type: 'LIBRARY_STORAGE_LIST' }) as Promise<LibraryResponse<ManagedStorageEntry[]>>,
      ]);
      if (response.status !== 'success') throw new Error(response.message);
      setEntries([
        ...captures.map(capture => ({
          id: capture.id,
          category: 'captures' as const,
          title: capture.title,
          url: capture.source.url,
          updatedAt: capture.updatedAt,
          sizeBytes: capture.sizeBytes,
        })),
        ...response.data,
      ]);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not read local storage.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const visible = useMemo(
    () =>
      entries
        .filter(
          entry =>
            (!category || entry.category === category) &&
            (!query || `${entry.title} ${entry.url}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())) &&
            (!before || entry.updatedAt <= new Date(`${before}T23:59:59.999`).getTime()) &&
            (!minimum || entry.sizeBytes >= Number(minimum) * 1024),
        )
        .sort((a, b) => (sort === 'size' ? b.sizeBytes - a.sizeBytes : a.updatedAt - b.updatedAt)),
    [entries, category, query, before, minimum, sort],
  );
  const chosen = entries.filter(entry => selected.includes(keyFor(entry)));
  const bytes = chosen.reduce((total, entry) => total + entry.sizeBytes, 0);
  const remove = async () => {
    setBusy(true);
    setError('');
    setStatus('');
    try {
      // A category commits independently. On failure refresh the preview before retrying.
      for (const category of ['captures', 'ai', 'diagnostics'] as const) {
        const ids = chosen.filter(entry => entry.category === category).map(entry => entry.id);
        if (!ids.length) continue;
        if (category === 'captures') await deleteLibraryCaptures(ids);
        else {
          for (let start = 0; start < ids.length; start += 10_000) {
            const response = (await chrome.runtime.sendMessage({
              type: 'LIBRARY_STORAGE_DELETE',
              category,
              ids: ids.slice(start, start + 10_000),
            })) as LibraryResponse<null>;
            if (response.status !== 'success') throw new Error(response.message);
          }
        }
      }
      setStatus(`Deleted ${chosen.length} selected items.`);
      setSelected([]);
      setConfirming(false);
      await refresh();
    } catch (cause) {
      await refresh();
      setConfirming(false);
      setSelected([]);
      setError(
        `Some items may already have been removed. ${cause instanceof Error ? cause.message : 'Review the refreshed list and try again.'}`,
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <a className="library-back" href="index.html">
        ← All captures
      </a>
      <p className="library-eyebrow">ON THIS DEVICE</p>
      <h1>Storage &amp; cleanup</h1>
      <p className="library-muted">
        Saved content sizes exclude browser overhead. Nothing is deleted automatically. New diagnostics can arrive while
        pages remain open.
      </p>
      <div className="storage-totals">
        {(['captures', 'ai', 'diagnostics'] as const).map(category => {
          const items = entries.filter(entry => entry.category === category);
          return (
            <section className="workspace-panel" key={category}>
              <h2>{categoryNames[category]}</h2>
              <strong>{formatBytes(items.reduce((total, entry) => total + entry.sizeBytes, 0))}</strong>
              <p className="library-muted">{items.length} saved items</p>
            </section>
          );
        })}
      </div>
      <section className="workspace-panel">
        <div className="workspace-filters">
          <label>
            Data type
            <select
              aria-label="Data type"
              value={category}
              disabled={busy}
              onChange={event => {
                setCategory(event.target.value);
                setConfirming(false);
              }}>
              <option value="">All types</option>
              {Object.entries(categoryNames).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Title or domain
            <input
              value={query}
              disabled={busy}
              onChange={event => {
                setQuery(event.target.value);
                setConfirming(false);
              }}
            />
          </label>
          <label>
            Saved before
            <input
              type="date"
              value={before}
              disabled={busy}
              onChange={event => {
                setBefore(event.target.value);
                setConfirming(false);
              }}
            />
          </label>
          <label>
            Minimum size (KB)
            <input
              type="number"
              min={0}
              value={minimum}
              disabled={busy}
              onChange={event => {
                setMinimum(event.target.value);
                setConfirming(false);
              }}
            />
          </label>
          <label>
            Sort by
            <select aria-label="Sort by" value={sort} onChange={event => setSort(event.target.value)}>
              <option value="size">Largest first</option>
              <option value="date">Oldest first</option>
            </select>
          </label>
        </div>
        <div className="workspace-actions">
          <button
            disabled={busy || !visible.length}
            onClick={() => {
              setSelected(previous => [...new Set([...previous, ...visible.map(keyFor)])]);
              setConfirming(false);
            }}>
            Select visible items
          </button>
          <button
            disabled={busy || !selected.length}
            onClick={() => {
              setSelected([]);
              setConfirming(false);
            }}>
            Clear selection
          </button>
          <button
            disabled={busy}
            onClick={() => {
              setConfirming(false);
              void refresh();
            }}>
            Refresh usage
          </button>
        </div>
        {loading && <p role="status">Reading saved content…</p>}
        {error && (
          <p role="alert" className="library-error">
            {error}
          </p>
        )}
        <div className="storage-list">
          {visible.map(entry => (
            <label className="storage-row" key={keyFor(entry)}>
              <input
                type="checkbox"
                disabled={busy}
                checked={selected.includes(keyFor(entry))}
                onChange={event => {
                  setSelected(previous =>
                    event.target.checked ? [...previous, keyFor(entry)] : previous.filter(key => key !== keyFor(entry)),
                  );
                  setConfirming(false);
                }}
                aria-label={`Select ${entry.title}`}
              />
              <span>
                <strong>{entry.title}</strong>
                <span className="library-muted">
                  {categoryNames[entry.category]} · {entry.url || 'No source URL'} ·{' '}
                  {new Date(entry.updatedAt).toLocaleDateString()}
                </span>
              </span>
              <span>{formatBytes(entry.sizeBytes)}</span>
            </label>
          ))}
        </div>
        {!loading && !visible.length && <p>No saved items match these filters.</p>}
        <p>
          {chosen.length} selected · approximately {formatBytes(bytes)}
        </p>
        <button className="library-danger" disabled={busy || !chosen.length} onClick={() => setConfirming(true)}>
          Review deletion
        </button>
        {confirming && (
          <section className="library-confirm" aria-label="Review selected deletion">
            <h2>Delete {chosen.length} selected items?</h2>
            <p>
              This permanently removes the selected captures and their originals, selected AI conversations, and
              selected diagnostic records.
            </p>
            <ul>
              {chosen.map(entry => (
                <li key={keyFor(entry)}>
                  {categoryNames[entry.category]}: {entry.title}
                </li>
              ))}
            </ul>
            <button className="library-danger" disabled={busy} onClick={() => void remove()}>
              Delete selected permanently
            </button>
            <button disabled={busy} onClick={() => setConfirming(false)}>
              Keep items
            </button>
          </section>
        )}
        <p role="status">{busy ? 'Deleting selected items…' : status}</p>
      </section>
    </>
  );
};

export default StoragePage;
