import { runtime } from 'webextension-polyfill';

/**
 * Requests all recorded events from the background script.
 *
 * @returns Promise<any[]> - The list of records.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getRecords = async (): Promise<any[]> => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: { records: any[] } = await runtime.sendMessage({ type: 'GET_RECORDS' });

    return response?.records ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    console.error('[getRecords] Failed:', err?.message || err);
    throw err;
  }
};

/**
 * Instructs the background script to delete all records.
 *
 * @returns Promise<{ status: string }> - The deletion result.
 */
export const deleteRecords = async (): Promise<{ status: string }> => {
  try {
    const response: { status: string } = await runtime.sendMessage({ type: 'DELETE_RECORDS' });

    return response ?? { status: 'unknown' };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    console.error('[deleteRecords] Failed:', err?.message || err);
    throw err;
  }
};
