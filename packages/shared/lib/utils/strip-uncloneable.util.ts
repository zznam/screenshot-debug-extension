/**
 * Removes fields known to be un-cloneable (like DOM elements) from the object.
 */
export const stripUnCloneable = (data: Record<string, unknown>) => {
  const clone: Record<string, unknown> = {};
  for (const key in data) {
    const value = data[key];

    if (value instanceof Node || value instanceof Window || typeof value === 'function') {
      continue;
    }

    clone[key] = value;
  }

  return clone;
};
