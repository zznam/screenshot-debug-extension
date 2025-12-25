/**
 * Checks if a given value is a valid JSON string.
 * @param value - The value to check.
 * @returns `true` if the value is a valid JSON string, otherwise `false`.
 */
export const isValidJSON = (value: unknown): boolean => {
  if (typeof value !== 'string') return false;
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
};
