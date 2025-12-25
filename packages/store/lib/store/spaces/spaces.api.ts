import { createApi } from '@reduxjs/toolkit/query/react';

import type { Pagination, Space } from '@extension/shared';

import { baseQueryWithReauth } from '../../services/index.js';

export const spacesAPI = createApi({
  reducerPath: 'spaces',
  tagTypes: ['SPACES'],
  baseQuery: baseQueryWithReauth,
  endpoints: build => ({
    createSpaces: build.mutation<Space[], Partial<any>>({
      invalidatesTags: ['SPACES'],
      query: body => ({
        url: '/spaces',
        method: 'POST',
        body,
      }),
    }),

    getSpaces: build.query<{ items: Space[]; total: number }, Pagination>({
      providesTags: ['SPACES'],
      query: params => ({
        url: '/spaces',
        params,
      }),
    }),
  }),
});
