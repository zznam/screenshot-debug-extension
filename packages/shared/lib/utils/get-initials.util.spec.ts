import { describe, expect, it } from 'vitest';

import { getInitials } from './get-initials.util.js';

describe('getInitials', () => {
  it('returns empty string for null, undefined, or empty values', () => {
    expect(getInitials(null)).toBe('');
    expect(getInitials(undefined)).toBe('');
    expect(getInitials('')).toBe('');
    expect(getInitials('   ')).toBe('');
  });

  it('extracts uppercase single initial from single-word names', () => {
    expect(getInitials('Alice')).toBe('A');
    expect(getInitials('bob')).toBe('B');
  });

  it('extracts uppercase first and last initials from multi-word names', () => {
    expect(getInitials('John Doe')).toBe('JD');
    expect(getInitials('john doe')).toBe('JD');
    expect(getInitials('John Fitzgerald Kennedy')).toBe('JK');
    expect(getInitials('  jane   mary   watson  ')).toBe('JW');
  });
});
