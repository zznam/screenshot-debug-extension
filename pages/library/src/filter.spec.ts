import { describe, expect, it } from 'vitest';

import type { CaptureSummary } from '@extension/shared';

import { filterCaptures } from './filter';

describe('library discovery', () => {
  const captures = [
    {
      title: 'Checkout failure',
      source: { title: 'Cart', domain: 'shop.test' },
      tags: ['Mobile'],
      kind: 'screenshots',
      createdAt: new Date('2026-10-04T12:00:00').getTime(),
    },
    {
      title: 'Settings',
      source: { title: 'Profile', domain: 'account.test' },
      tags: [],
      kind: 'screenshots',
      createdAt: new Date('2026-10-01T12:00:00').getTime(),
    },
  ] as CaptureSummary[];
  const empty = { search: '', domain: '', from: '', to: '', kind: '' };
  it('matches titles, source titles, domains and tags without case sensitivity', () => {
    for (const search of ['CHECKOUT', 'cart', 'SHOP.TEST', 'mobile'])
      expect(filterCaptures(captures, { ...empty, search })).toEqual([captures[0]]);
  });
  it('combines filters and includes the entire final local calendar day', () => {
    expect(filterCaptures(captures, { ...empty, from: '2026-10-04', to: '2026-10-04', domain: 'shop.test' })).toEqual([
      captures[0],
    ]);
    expect(filterCaptures(captures, { ...empty, domain: 'account.test', search: 'Checkout' })).toEqual([]);
    expect(filterCaptures(captures, { ...empty, kind: 'video' })).toEqual([]);
  });
});
