import { nonProductionKeywords } from '../constants/index.js';

/**
 * Check if the given URL belongs to a non-production environment.
 *
 * @param {string} url - The URL to check.
 * @returns {boolean} - Returns true if the URL contains any non-production keywords.
 */
export const isNonProduction = (url?: string): boolean => {
  if (!url) {
    url = typeof window !== 'undefined' ? window?.location?.href.toLowerCase() : '';
  }

  return nonProductionKeywords.some(env => url.includes(env.toLowerCase()));
};
