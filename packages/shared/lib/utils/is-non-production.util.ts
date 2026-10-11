import { nonProductionKeywords } from '../constants/non-production-keywords.constants.js';

/** Match development hosts, never text in a remote URL's path or query. */
export const isNonProduction = (url?: string): boolean => {
  const candidate = (url ?? (typeof window !== 'undefined' ? window.location.href : '')).trim();
  if (!candidate) return false;

  try {
    const withProtocol = candidate.includes('://') ? candidate : `http://${candidate}`;
    const hostname = new URL(withProtocol).hostname.toLowerCase().replace(/\.$/, '');
    if (!hostname) return false;

    if (hostname.endsWith('.local') || hostname.endsWith('.test')) {
      return true;
    }

    return nonProductionKeywords.some(keyword => hostname === keyword || hostname.endsWith(`.${keyword}`));
  } catch {
    return false;
  }
};
