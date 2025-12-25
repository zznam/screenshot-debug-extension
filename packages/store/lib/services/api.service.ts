import { fetchBaseQuery } from '@reduxjs/toolkit/query';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { Mutex } from 'async-mutex';
import { toast } from 'react-hot-toast';

// Offline mode: No API
import type { Tokens, UserAndTokensResponse } from '@extension/shared';
import { authTokensStorage } from '@extension/storage';

const mutex = new Mutex();
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
  args,
  api,
  extraOptions,
) => {
  await mutex.waitForUnlock();
  // Stubbed for offline extension
  return { error: { status: 503, data: 'Offline Mode' } };

  // Stubbed for offline extension
  return { error: { status: 503, data: 'Offline Mode' } };
};
