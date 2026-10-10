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
  const fromTime = filters.from ? new Date(filters.from + 'T00:00:00').getTime() : NaN;
  const from = Number.isNaN(fromTime) ? -Infinity : fromTime;

  const toTime = filters.to ? new Date(filters.to + 'T23:59:59.999').getTime() : NaN;
  const to = Number.isNaN(toTime) ? Infinity : toTime;

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

const formatBytes = (bytes: number) => {
  if (bytes <= 0 || !Number.isFinite(bytes)) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export { filterCaptures, formatBytes };
export type { LibraryFilters };
