export interface IsValidJSONOptions {
  /** If true, only JSON objects or arrays are considered valid (not primitives like "123", "true", "null"). Defaults to false. */
  objectsOnly?: boolean;
}

/**
 * Checks if a given value is a valid JSON string.
 * @param value - The value to check.
 * @param options - Optional configuration (e.g. objectsOnly).
 * @returns `true` if the value is a valid JSON string, otherwise `false`.
 */
export const isValidJSON = (value: unknown, options?: IsValidJSONOptions): boolean => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;

  if (options?.objectsOnly && !trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return false;
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (options?.objectsOnly) {
      return parsed !== null && typeof parsed === 'object';
    }
    return true;
  } catch {
    return false;
  }
};

/**
 * Safely parses a JSON string, returning fallback if parsing fails or input is not a string.
 * @param value - The string to parse.
 * @param fallback - The fallback value if parsing fails.
 */
export const safeJsonParse = <T = unknown>(value: unknown, fallback?: T): T | undefined => {
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};
