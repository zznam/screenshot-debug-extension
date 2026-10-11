import { describe, expect, it } from 'vitest';

import { extractQueryParams } from './extract-query-params.util';

describe('extractQueryParams', () => {
  it('extracts query parameters from full HTTP URLs', () => {
    const url = 'https://example.com/api/search?term=bugs&page=2&sort=asc';
    expect(extractQueryParams(url)).toEqual({
      term: 'bugs',
      page: '2',
      sort: 'asc',
    });
  });

  it('extracts query parameters from relative URLs and search strings', () => {
    expect(extractQueryParams('/users?id=123')).toEqual({ id: '123' });
    expect(extractQueryParams('?preview=true&mode=dark')).toEqual({
      preview: 'true',
      mode: 'dark',
    });
    expect(extractQueryParams('relative/path?token=abc')).toEqual({ token: 'abc' });
  });

  it('ignores prototype pollution keys in query params', () => {
    const url = 'https://example.com/data?__proto__=polluted&constructor=bad&valid=yes';
    const params = extractQueryParams(url);
    expect(params).toEqual({ valid: 'yes' });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('handles empty, null, undefined, and invalid inputs gracefully', () => {
    expect(extractQueryParams('')).toEqual({});
    expect(extractQueryParams('   ')).toEqual({});
    expect(extractQueryParams(null)).toEqual({});
    expect(extractQueryParams(undefined)).toEqual({});
    expect(extractQueryParams('https://example.com/no-params')).toEqual({});
  });
});
