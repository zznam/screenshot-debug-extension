import type { CaptureSummary } from '@extension/shared';

interface LibraryFilters {
  search: string;
  domain: string;
  from: string;
  to: string;
  kind: string;
}

const filterCaptures = (captures: CaptureSummary[], filters: LibraryFilters) => {
  if (!Array.isArray(captures)) return [];
  const query = filters?.search ? filters.search.trim().toLocaleLowerCase() : '';
  const fromTime = filters?.from ? new Date(filters.from + 'T00:00:00').getTime() : NaN;
  const from = Number.isNaN(fromTime) ? -Infinity : fromTime;

  const toTime = filters?.to ? new Date(filters.to + 'T23:59:59.999').getTime() : NaN;
  const to = Number.isNaN(toTime) ? Infinity : toTime;

  return captures.filter(capture => {
    if (!capture) return false;

    const sourceDomain = capture.source?.domain || '';
    const sourceTitle = capture.source?.title || '';
    const tags = Array.isArray(capture.tags) ? capture.tags : [];

    const matchesQuery =
      !query ||
      [capture.title, sourceTitle, sourceDomain, ...tags]
        .filter((val): val is string => typeof val === 'string' && val.length > 0)
        .some(val => val.toLocaleLowerCase().includes(query));

    const matchesDomain = !filters?.domain || sourceDomain === filters.domain;
    const matchesKind = !filters?.kind || capture.kind === filters.kind;
    const matchesDate =
      typeof capture.createdAt !== 'number' || Number.isNaN(capture.createdAt)
        ? true
        : capture.createdAt >= from && capture.createdAt <= to;

    return matchesQuery && matchesDomain && matchesKind && matchesDate;
  });
};

const formatBytes = (bytes: number) => {
  if (bytes <= 0 || !Number.isFinite(bytes)) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes < 1024 * 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  return `${(bytes / (1024 * 1024 * 1024 * 1024)).toFixed(1)} TB`;
};

export { filterCaptures, formatBytes };
export type { LibraryFilters };
