import { createApi } from '@reduxjs/toolkit/query/react';

import { baseQueryWithReauth } from '../../services/index.js';

export const screenshotAPI = createApi({
  reducerPath: 'screenshots',
  baseQuery: baseQueryWithReauth,

  endpoints: build => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getFullScreenshot: build.query<any, { url: string }>({
      query: ({ url }) => ({
        url: '/screenshots',
        params: { url },
      }),
    }),
  }),
});
