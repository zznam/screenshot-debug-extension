// Utility to extract query parameters safely
export const extractQueryParams = (url?: string | null): Record<string, string> => {
  if (!url || typeof url !== 'string' || !url.trim()) return {};

  try {
    const baseOrigin =
      typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'http://localhost';

    const normalizedUrl = url.includes('://')
      ? url
      : url.startsWith('/') || url.startsWith('?')
        ? `${baseOrigin}${url}`
        : `${baseOrigin}/${url}`;

    const parsed = new URL(normalizedUrl);
    const result: Record<string, string> = {};

    parsed.searchParams.forEach((value, key) => {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') return;
      result[key] = value;
    });

    return result;
  } catch {
    return {};
  }
};
