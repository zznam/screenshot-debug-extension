/**
 * Utility to truncate large response strings while preserving other data types as-is.
 *
 * @param responseBody - The response body to potentially truncate.
 * @param maxLength - Maximum character length before truncation (default 1000).
 * @param suffix - Suffix appended when truncated (default '... (truncated)').
 */
export const truncateResponse = <T = unknown>(
  responseBody: T,
  maxLength = 1000,
  suffix = '... (truncated)',
): T | string => {
  if (typeof responseBody !== 'string') {
    return responseBody;
  }

  const safeLimit = Math.max(0, Number.isFinite(maxLength) ? maxLength : 1000);

  if (responseBody.length <= safeLimit) {
    return responseBody;
  }

  return `${responseBody.slice(0, safeLimit)}${suffix}`;
};
