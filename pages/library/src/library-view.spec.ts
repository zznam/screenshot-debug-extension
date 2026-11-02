import { describe, expect, it } from 'vitest';

import type { CaptureSummary } from '@extension/shared';

import { emptyFilters, libraryQuery, readLibraryView, sortCaptures } from './library-view';

describe('library view', () => {
  it('round-trips filters, sort and pagination without admitting unrelated URL fields', () => {
    const filters = {
      ...emptyFilters,
      search: 'checkout & cart',
      domain: 'shop.example',
      from: '2026-10-01',
      tag: 'Mobile & Tablet',
      favorite: 'only',
      status: 'resolved',
    };
    const query = libraryQuery(filters, 'size', 3);
    expect(readLibraryView(query)).toEqual({ filters, sort: 'size', page: 3 });
    expect(libraryQuery(readLibraryView('?capture=secret&search=cart').filters, 'newest', 1)).toBe('?search=cart');
  });
  it.each(['-1', '0', '1.5', 'NaN', 'Infinity', '9007199254740993'])(
    'normalizes invalid page %s and unknown sort',
    page => {
      expect(readLibraryView(`?page=${page}&sort=unknown`)).toMatchObject({ page: 1, sort: 'newest' });
    },
  );
  it('ignores unknown favorite and status query values', () => {
    expect(readLibraryView('?favorite=unknown&status=unknown').filters).toEqual(emptyFilters);
  });
  it('sorts a copy with a deterministic tie break', () => {
    const captures = [
      { id: 'b', title: 'Zebra', createdAt: 2, sizeBytes: 10 },
      { id: 'a', title: 'Alpha', createdAt: 1, sizeBytes: 20 },
      { id: 'c', title: 'Zebra', createdAt: 2, sizeBytes: 10 },
    ] as CaptureSummary[];
    expect(sortCaptures(captures, 'newest').map(item => item.id)).toEqual(['b', 'c', 'a']);
    expect(sortCaptures(captures, 'oldest').map(item => item.id)).toEqual(['a', 'b', 'c']);
    expect(sortCaptures(captures, 'size').map(item => item.id)).toEqual(['a', 'b', 'c']);
    expect(sortCaptures(captures, 'title').map(item => item.id)).toEqual(['a', 'b', 'c']);
    expect(captures[0].id).toBe('b');
  });
});
