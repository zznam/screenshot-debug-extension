/**
 * Recursively removes fields known to be un-cloneable (like DOM elements, functions, circular references)
 * from objects and arrays, protecting against prototype pollution.
 */
const isUncloneableValue = (value: unknown): boolean => {
  if (typeof value === 'function' || typeof value === 'symbol') {
    return true;
  }
  if (typeof Node !== 'undefined' && value instanceof Node) {
    return true;
  }
  if (typeof Window !== 'undefined' && value instanceof Window) {
    return true;
  }
  return false;
};

const deepStripInternal = (input: unknown, seen: WeakSet<object>): unknown => {
  if (input === null || typeof input !== 'object') {
    return isUncloneableValue(input) ? undefined : input;
  }

  if (isUncloneableValue(input)) {
    return undefined;
  }

  if (seen.has(input)) {
    return Array.isArray(input) ? [] : {};
  }
  seen.add(input);

  if (Array.isArray(input)) {
    const result: unknown[] = [];
    for (const item of input) {
      if (!isUncloneableValue(item)) {
        result.push(deepStripInternal(item, seen));
      }
    }
    return result;
  }

  const clone: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }
    if (isUncloneableValue(value)) {
      continue;
    }
    clone[key] = deepStripInternal(value, seen);
  }
  return clone;
};

export const stripUnCloneable = <T = Record<string, unknown>>(data: T): T => {
  if (data === null || typeof data !== 'object') {
    return (isUncloneableValue(data) ? undefined : data) as T;
  }
  return deepStripInternal(data, new WeakSet()) as T;
};
