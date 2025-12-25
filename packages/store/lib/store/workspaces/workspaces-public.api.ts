import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

// Offline mode: No API
import type { Workspace } from '@extension/shared';

export const workspacesPublicAPI = createApi({
  reducerPath: 'workspaces-public',
  baseQuery: fetchBaseQuery({ baseUrl: '' }),
  endpoints: build => ({
    getWorkspacePublicById: build.query<Workspace, { id: string }>({
      query: ({ id }) => ({
        url: `/workspaces/public/${id}`,
      }),
    }),
  }),
});
