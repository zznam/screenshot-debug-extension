import { libraryQuery, readLibraryView } from './library-view';

interface SavedView {
  id: string;
  name: string;
  query: string;
}

const SAVED_VIEWS_KEY = 'capture-library-saved-views-v1';
const MAX_SAVED_VIEWS = 20;
const normalizeQuery = (query: string) => {
  const view = readLibraryView(query);
  return libraryQuery(view.filters, view.sort, 1);
};
const parseSavedViews = (serialized: string | null): SavedView[] => {
  if (!serialized) return [];
  const data: unknown = JSON.parse(serialized);
  if (!data || typeof data !== 'object' || !('version' in data) || data.version !== 1 || !('views' in data))
    throw new Error('The saved views format is not supported.');
  if (!Array.isArray(data.views) || data.views.length > MAX_SAVED_VIEWS)
    throw new Error('The saved views list is invalid.');
  const ids = new Set<string>();
  return data.views.map((view: unknown) => {
    if (
      !view ||
      typeof view !== 'object' ||
      !('id' in view) ||
      typeof view.id !== 'string' ||
      !view.id ||
      ids.has(view.id) ||
      !('name' in view) ||
      typeof view.name !== 'string' ||
      !view.name.trim() ||
      view.name.length > 60 ||
      !('query' in view) ||
      typeof view.query !== 'string' ||
      view.query.length > 20_000
    )
      throw new Error('A saved view is invalid.');
    ids.add(view.id);
    return { id: view.id, name: view.name.trim(), query: normalizeQuery(view.query) };
  });
};

const saveView = (views: SavedView[], name: string, query: string, newId: string): SavedView[] => {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 60) throw new Error('Name your view using 1–60 characters.');
  const normalizedQuery = normalizeQuery(query);
  if (normalizedQuery.length > 20_000) throw new Error('This view is too large to save. Shorten your search.');
  const existing = views.find(view => view.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase());
  if (!existing && views.length >= MAX_SAVED_VIEWS)
    throw new Error('You can save 20 views. Delete one to add another.');
  const next = { id: existing?.id ?? newId, name: trimmed, query: normalizedQuery };
  return existing ? views.map(view => (view.id === existing.id ? next : view)) : [...views, next];
};

export { MAX_SAVED_VIEWS, SAVED_VIEWS_KEY, parseSavedViews, saveView };
export type { SavedView };
