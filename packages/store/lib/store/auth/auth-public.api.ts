import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

// Offline mode: No API
import type { UserAndTokensResponse } from '@extension/shared';

export const authPublicAPI = createApi({
  reducerPath: 'authPublic',
  baseQuery: fetchBaseQuery({ baseUrl: '' }),
  endpoints: build => ({
    loginGuest: build.mutation<UserAndTokensResponse, { uuid: string }>({
      query: body => ({
        url: '/auth/login/guest',
        method: 'POST',
        body,
      }),
    }),
  }),
});
