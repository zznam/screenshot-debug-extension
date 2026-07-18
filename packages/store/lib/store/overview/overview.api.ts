import { createApi } from '@reduxjs/toolkit/query/react';

import type { Pagination } from '@extension/shared';

import { baseQueryWithReauth } from '../../services/index.js';

export const overviewAPI = createApi({
  reducerPath: 'overview',
  baseQuery: baseQueryWithReauth,

  endpoints: build => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getOverview: build.query<any, Pagination>({
      query: ({ limit, take, start, end }) => ({
        url: '/overview',
        params: { limit, take, start, end },
      }),
    }),
  }),
});
