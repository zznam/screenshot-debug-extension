import { nonProductionKeywords } from '../constants/non-production-keywords.constants.js';

/** Match development hosts, never text in a remote URL's path or query. */
export const isNonProduction = (url?: string): boolean => {
  const candidate = url ?? (typeof window !== 'undefined' ? window.location.href : '');
  try {
    const hostname = new URL(candidate).hostname.toLowerCase();
    return nonProductionKeywords.some(keyword => hostname === keyword || hostname.endsWith(`.${keyword}`));
  } catch {
    return false;
  }
};
