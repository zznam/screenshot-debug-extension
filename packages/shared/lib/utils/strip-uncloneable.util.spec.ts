import { describe, expect, it } from 'vitest';

import { stripUnCloneable } from './strip-uncloneable.util.js';
import { safeStructuredClone } from './structured-clone.util.js';

describe('stripUnCloneable', () => {
  it('strips functions and symbols shallowly and deeply', () => {
    const input = {
      name: 'test',
      fn: () => 'hello',
      sym: Symbol('sym'),
      nested: {
        active: true,
        callback: () => 42,
        deep: {
          id: 123,
          action: () => undefined,
        },
      },
    };

    const output = stripUnCloneable(input);
    expect(output).toEqual({
      name: 'test',
      nested: {
        active: true,
        deep: {
          id: 123,
        },
      },
    });
  });

  it('filters uncloneable items inside arrays', () => {
    const input = [1, () => 'skip', 'valid', Symbol('skip'), { a: 1, fn: () => 2 }];
    const output = stripUnCloneable(input);
    expect(output).toEqual([1, 'valid', { a: 1 }]);
  });

  it('protects against prototype pollution keys', () => {
    const malicious = JSON.parse('{"__proto__":{"polluted":true},"name":"safe","constructor":{"hack":1}}');
    const cleaned = stripUnCloneable(malicious);
    expect(cleaned).toEqual({ name: 'safe' });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('safely handles circular references without infinite recursion', () => {
    const obj: Record<string, unknown> = { id: 1 };
    obj.self = obj;

    const cleaned = stripUnCloneable(obj);
    expect(cleaned).toEqual({ id: 1, self: {} });
  });

  it('handles null, undefined, and primitive inputs', () => {
    expect(stripUnCloneable(null)).toBeNull();
    expect(stripUnCloneable(undefined)).toBeUndefined();
    expect(stripUnCloneable('hello')).toBe('hello');
    expect(stripUnCloneable(42)).toBe(42);
    expect(stripUnCloneable(true)).toBe(true);
  });
});

describe('safeStructuredClone', () => {
  it('clones standard serializable data', () => {
    const data = { a: [1, 2, 3], b: { c: 'hello' } };
    const cloned = safeStructuredClone(data);
    expect(cloned).toEqual(data);
    expect(cloned).not.toBe(data);
  });

  it('falls back to stripping uncloneables when structuredClone fails on functions', () => {
    const data = {
      id: 'item-1',
      handler: () => 'click',
      meta: { count: 5 },
    };

    const cloned = safeStructuredClone(data);
    expect(cloned).toEqual({
      id: 'item-1',
      meta: { count: 5 },
    });
  });
});
