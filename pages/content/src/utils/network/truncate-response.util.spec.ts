import { describe, expect, it } from 'vitest';

import { truncateResponse } from './truncate-response.util';

describe('truncateResponse', () => {
  it('leaves short strings untouched', () => {
    const text = 'Short response text';
    expect(truncateResponse(text)).toBe(text);
  });

  it('truncates strings exceeding default 1000 limit with default suffix', () => {
    const longText = 'a'.repeat(1200);
    const result = truncateResponse(longText);
    expect(result).toBe('a'.repeat(1000) + '... (truncated)');
    expect(result).toHaveLength(1000 + '... (truncated)'.length);
  });

  it('supports custom maxLength and suffix', () => {
    const text = 'Hello, this is a longer description';
    expect(truncateResponse(text, 5, ' [more]')).toBe('Hello [more]');
  });

  it('leaves non-string inputs untouched', () => {
    const obj = { data: 'test', count: 42 };
    expect(truncateResponse(obj)).toBe(obj);
    expect(truncateResponse(null)).toBeNull();
    expect(truncateResponse(undefined)).toBeUndefined();
    expect(truncateResponse(12345)).toBe(12345);
    expect(truncateResponse(true)).toBe(true);
  });

  it('handles zero or negative maxLength safely', () => {
    expect(truncateResponse('abc', 0, '...')).toBe('...');
    expect(truncateResponse('abc', -5, '...')).toBe('...');
  });
});
