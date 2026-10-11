import { describe, expect, it } from 'vitest';

import { isValidJSON, safeJsonParse } from './is-valid-json.util.js';

describe('isValidJSON', () => {
  it('validates standard JSON objects and arrays', () => {
    expect(isValidJSON('{"a": 1, "b": "hello"}')).toBe(true);
    expect(isValidJSON('[1, 2, "three"]')).toBe(true);
  });

  it('validates JSON primitive values by default', () => {
    expect(isValidJSON('"hello"')).toBe(true);
    expect(isValidJSON('123')).toBe(true);
    expect(isValidJSON('true')).toBe(true);
    expect(isValidJSON('null')).toBe(true);
  });

  it('rejects invalid or non-string inputs', () => {
    expect(isValidJSON('')).toBe(false);
    expect(isValidJSON('   ')).toBe(false);
    expect(isValidJSON('{ invalid json }')).toBe(false);
    expect(isValidJSON(null)).toBe(false);
    expect(isValidJSON(undefined)).toBe(false);
    expect(isValidJSON(123)).toBe(false);
    expect(isValidJSON({ a: 1 })).toBe(false);
  });

  it('enforces objectsOnly constraint when requested', () => {
    expect(isValidJSON('{"key": "val"}', { objectsOnly: true })).toBe(true);
    expect(isValidJSON('[1, 2, 3]', { objectsOnly: true })).toBe(true);

    expect(isValidJSON('"string"', { objectsOnly: true })).toBe(false);
    expect(isValidJSON('123', { objectsOnly: true })).toBe(false);
    expect(isValidJSON('true', { objectsOnly: true })).toBe(false);
    expect(isValidJSON('null', { objectsOnly: true })).toBe(false);
  });
});

describe('safeJsonParse', () => {
  it('parses valid JSON string into typed structure', () => {
    const parsed = safeJsonParse<{ count: number }>('{"count": 5}');
    expect(parsed).toEqual({ count: 5 });
  });

  it('returns fallback when parsing fails or input is not a string', () => {
    expect(safeJsonParse('{invalid}', { default: true })).toEqual({ default: true });
    expect(safeJsonParse('', 'fallback')).toBe('fallback');
    expect(safeJsonParse(null, null)).toBeNull();
    expect(safeJsonParse(undefined)).toBeUndefined();
  });
});
