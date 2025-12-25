import { createApi } from '@reduxjs/toolkit/query/react';

import type { Organization } from '@extension/shared';

import { baseQueryWithReauth } from '../../services/index.js';

export const organizationAPI = createApi({
  reducerPath: 'organization',
  tagTypes: ['ORGANIZATION'],
  baseQuery: baseQueryWithReauth,
  endpoints: build => ({
    getOrganizationById: build.query<Organization, void>({
      providesTags: ['ORGANIZATION'],
      query: () => ({
        url: '/users/organization',
      }),
    }),
  }),
});
