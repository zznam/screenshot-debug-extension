import type { CaptureSummary } from '@extension/shared';

import type { LibraryFilters } from './filter';

const PAGE_SIZE = 24;
const sortOrders = ['newest', 'oldest', 'title', 'size'] as const;
type SortOrder = (typeof sortOrders)[number];
const emptyFilters: LibraryFilters = {
  search: '',
  domain: '',
  from: '',
  to: '',
  kind: '',
  tag: '',
  favorite: '',
  status: '',
};
const readLibraryView = (search: string) => {
  const params = new URLSearchParams(search);
  const order = params.get('sort');
  const page = Number(params.get('page'));
  const filters = Object.fromEntries(
    Object.keys(emptyFilters).map(key => [key, params.get(key) ?? '']),
  ) as unknown as LibraryFilters;
  if (filters.favorite !== 'only') filters.favorite = '';
  if (!['open', 'in-progress', 'resolved'].includes(filters.status ?? '')) filters.status = '';
  return {
    filters,
    sort: sortOrders.includes(order as SortOrder) ? (order as SortOrder) : ('newest' as SortOrder),
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
  };
};
const libraryQuery = (filters: LibraryFilters, sort: SortOrder, page: number) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  if (sort !== 'newest') params.set('sort', sort);
  if (page > 1) params.set('page', String(page));
  return params.size ? `?${params}` : '';
};
const sortCaptures = (captures: CaptureSummary[], sort: SortOrder) =>
  [...captures].sort((a, b) => {
    const order =
      sort === 'oldest'
        ? a.createdAt - b.createdAt
        : sort === 'title'
          ? a.title.localeCompare(b.title)
          : sort === 'size'
            ? b.sizeBytes - a.sizeBytes
            : b.createdAt - a.createdAt;
    return order || a.id.localeCompare(b.id);
  });
const libraryHome = () => {
  try {
    const view = readLibraryView(sessionStorage.getItem('library-view') ?? '');
    return `index.html${libraryQuery(view.filters, view.sort, view.page)}`;
  } catch {
    return 'index.html';
  }
};

export { PAGE_SIZE, emptyFilters, readLibraryView, libraryQuery, sortCaptures, libraryHome };
export type { SortOrder };
