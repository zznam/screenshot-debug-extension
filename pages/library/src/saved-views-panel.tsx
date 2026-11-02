import { useEffect, useState } from 'react';

import { libraryQuery, readLibraryView } from './library-view';
import { parseSavedViews, SAVED_VIEWS_KEY, saveView } from './saved-views';
import type { SavedView } from './saved-views';

import './workspace-navigation.css';

type LibraryView = ReturnType<typeof readLibraryView>;

const SavedViewsPanel = ({ view, apply }: { view: LibraryView; apply: (view: LibraryView) => void }) => {
  const [views, setViews] = useState<SavedView[]>([]);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  useEffect(() => {
    const load = () => {
      try {
        setViews(parseSavedViews(localStorage.getItem(SAVED_VIEWS_KEY)));
        setError('');
      } catch {
        setError('Saved views could not be read. Your capture library is still available.');
      }
    };
    load();
    const changed = (event: StorageEvent) => {
      if (event.key === SAVED_VIEWS_KEY || event.key === null) load();
    };
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, []);
  const persist = (change: (current: SavedView[]) => SavedView[]) => {
    setError('');
    setStatus('');
    try {
      const next = change(parseSavedViews(localStorage.getItem(SAVED_VIEWS_KEY)));
      localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify({ version: 1, views: next }));
      setViews(next);
      return next;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save views on this device.');
      return null;
    }
  };
  const active = views.find(item => item.id === selected);
  return (
    <section className="saved-views" aria-label="Saved library views">
      <form
        onSubmit={event => {
          event.preventDefault();
          const next = persist(current =>
            saveView(current, name, libraryQuery(view.filters, view.sort, 1), crypto.randomUUID()),
          );
          if (next) {
            setSelected(next.find(item => item.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase())!.id);
            setName('');
            setStatus('View saved on this device.');
          }
        }}>
        <label>
          Saved view name
          <input
            value={name}
            maxLength={60}
            placeholder="e.g. Checkout bugs"
            onChange={event => setName(event.target.value)}
          />
        </label>
        <button type="submit" disabled={!name.trim()}>
          Save current view
        </button>
      </form>
      <div className="saved-view-picker">
        <label>
          Saved views
          <select aria-label="Saved views" value={active?.id ?? ''} onChange={event => setSelected(event.target.value)}>
            <option value="">Choose a saved view</option>
            {views.map(item => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <button
          disabled={!active}
          onClick={() => {
            if (!active) return;
            apply(readLibraryView(active.query));
            setStatus(`Applied “${active.name}”.`);
          }}>
          Apply saved view
        </button>
        <button
          disabled={!active}
          onClick={() => {
            if (!active) return;
            if (persist(current => current.filter(item => item.id !== active.id))) {
              setSelected('');
              setStatus('Saved view deleted.');
            }
          }}>
          Delete saved view
        </button>
      </div>
      <p className="library-muted">Save filters and sorting for later. Reusing a name updates that view.</p>
      {error && (
        <p role="alert" className="library-error">
          {error}
        </p>
      )}
      <p role="status" aria-live="polite">
        {status}
      </p>
    </section>
  );
};

export { SavedViewsPanel };
