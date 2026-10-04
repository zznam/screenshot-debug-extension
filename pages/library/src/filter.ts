import type { CaptureSummary } from '@extension/shared';

interface LibraryFilters {
  search: string;
  domain: string;
  from: string;
  to: string;
  kind: string;
}

const filterCaptures = (captures: CaptureSummary[], filters: LibraryFilters) => {
  const query = filters.search.trim().toLocaleLowerCase();
  const from = filters.from ? new Date(filters.from + 'T00:00:00').getTime() : -Infinity;
  const to = filters.to ? new Date(filters.to + 'T23:59:59.999').getTime() : Infinity;
  return captures.filter(
    capture =>
      (!query ||
        [capture.title, capture.source.title, capture.source.domain, ...capture.tags].some(value =>
          value.toLocaleLowerCase().includes(query),
        )) &&
      (!filters.domain || capture.source.domain === filters.domain) &&
      (!filters.kind || capture.kind === filters.kind) &&
      capture.createdAt >= from &&
      capture.createdAt <= to,
  );
};
const formatBytes = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export { filterCaptures, formatBytes };
export type { LibraryFilters };
