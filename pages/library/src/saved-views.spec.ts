import { describe, expect, it } from 'vitest';

import { parseSavedViews, saveView } from './saved-views';

describe('saved library views', () => {
  it('round-trips a saved view while excluding capture routes and stale pagination', () => {
    const views = saveView(
      [],
      '  Checkout  ',
      '?search=checkout&domain=shop.test&sort=size&page=3&capture=private&share=1',
      'id',
    );
    expect(parseSavedViews(JSON.stringify({ version: 1, views }))).toEqual([
      { id: 'id', name: 'Checkout', query: '?search=checkout&domain=shop.test&sort=size' },
    ]);
  });
  it('updates an existing name without creating a duplicate or changing its identity', () => {
    const views = saveView([{ id: 'one', name: 'Checkout', query: '?search=old' }], 'checkout', '?search=new', 'two');
    expect(views).toEqual([{ id: 'one', name: 'checkout', query: '?search=new' }]);
  });
  it('rejects malformed stored data instead of overwriting it', () => {
    expect(parseSavedViews(null)).toEqual([]);
    for (const value of ['{', '{}', '{"version":2,"views":[]}', '{"version":1,"views":[null]}']) {
      expect(() => parseSavedViews(value)).toThrow();
    }
    const view = { id: 'same', name: 'one', query: '' };
    expect(() => parseSavedViews(JSON.stringify({ version: 1, views: [view, view] }))).toThrow();
  });
  it('bounds view count and names while allowing an update at capacity', () => {
    const views = Array.from({ length: 20 }, (_, index) => ({ id: String(index), name: `View ${index}`, query: '' }));
    expect(() => saveView(views, 'New', '', 'new')).toThrow(/20 views/);
    expect(saveView(views, 'View 1', '?search=new', 'ignored')).toHaveLength(20);
    expect(() => saveView([], ' ', '', 'id')).toThrow();
    expect(() => saveView([], 'x'.repeat(61), '', 'id')).toThrow();
  });
  it('only saves query sizes that can be restored later', () => {
    const atLimit = saveView([], 'Long search', `?search=${'x'.repeat(19_992)}`, 'one');
    expect(parseSavedViews(JSON.stringify({ version: 1, views: atLimit }))).toEqual(atLimit);
    expect(() => saveView(atLimit, 'Too long', `?search=${'x'.repeat(19_993)}`, 'two')).toThrow(/Shorten/);
    expect(atLimit).toHaveLength(1);
  });
});
