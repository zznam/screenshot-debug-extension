import { describe, expect, it } from 'vitest';

import { capitalizeWord } from './capitalize.util.js';

describe('capitalizeWord', () => {
  it('handles empty, null, and non-string inputs safely', () => {
    expect(capitalizeWord('')).toBe('');
    expect(capitalizeWord(null)).toBe('');
    expect(capitalizeWord(undefined)).toBe('');
    expect(capitalizeWord('   ')).toBe('');
  });

  it('capitalizes lowercase and mixed-case words', () => {
    expect(capitalizeWord('hello')).toBe('Hello');
    expect(capitalizeWord('wORLD')).toBe('World');
    expect(capitalizeWord('recording')).toBe('Recording');
    expect(capitalizeWord('  active  ')).toBe('Active');
  });
});
