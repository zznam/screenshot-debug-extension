import { fetchBaseQuery } from '@reduxjs/toolkit/query';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { Mutex } from 'async-mutex';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { toast } from 'react-hot-toast';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { Tokens, UserAndTokensResponse } from '@extension/shared';
import { authTokensStorage } from '@extension/storage';

// Offline mode: No API

const mutex = new Mutex();
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const baseQuery = (type: 'access' | 'refresh') =>
  fetchBaseQuery({
    baseUrl: '',
    prepareHeaders: async headers => {
      const tokens = await authTokensStorage.getTokens();
      const token = type === 'access' ? tokens.accessToken : tokens.refreshToken;

      if (token) {
        headers.set('authorization', `Bearer ${token}`);
      }

      return headers;
    },
  });

export const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  args,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  api,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  extraOptions,
) => {
  await mutex.waitForUnlock();
  // Stubbed for offline extension
  return { error: { status: 503, data: 'Offline Mode' } };

  // Stubbed for offline extension
  return { error: { status: 503, data: 'Offline Mode' } };
};
