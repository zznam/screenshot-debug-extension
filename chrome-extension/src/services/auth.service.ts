import { identity } from 'webextension-polyfill';

import type { BgResponse } from '@src/types';
import { sendMessageToActiveTab } from '@src/utils';

export const handleOnAuthStart = async (): Promise<BgResponse> => {
  // Disable server authentication for debug extension
  console.log('[auth.service] Auth skipped for debug extension');
  await sendMessageToActiveTab('AUTH_STATUS', { ok: true });
  return { ok: true };
};
