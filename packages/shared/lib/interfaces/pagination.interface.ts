import type { OrderBy } from './query-filter.interface.js';

export interface Pagination {
  limit: number;
  take: number;
  order?: OrderBy;
  orderProperty?: string;
  q?: string;
  excludeIds?: boolean;
  start?: string;
  end?: string;
  favorite?: boolean;
  workspaceId?: string;
  spaceId?: string;
  status?: string;
  priority?: string;
  excludeStatus?: string;
}
