import { describe, expect, it } from 'vitest';

import { deepRedactSensitiveInfo } from './redact-sensitive-info.util.js';
import { REDACTED_KEYWORD } from '../constants/redacted-keyword.constants.js';

const redact = <T>(value: T) => deepRedactSensitiveInfo(value, 'https://example.com');

describe('sensitive diagnostic redaction', () => {
  it('redacts every kind of secret in a single console message', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature';
    const apiKey = `sk-${'a'.repeat(40)}`;
    const otherKey = `hf_${'b'.repeat(40)}`;
    const result = redact(`Bearer ${jwt}; key ${apiKey}; key ${otherKey}; password="hunter2"`);
    for (const secret of [jwt, apiKey, otherKey, 'hunter2']) expect(result).not.toContain(secret);
    expect(result.match(/REDACTED_BY_BRIE/g)).toHaveLength(4);
  });

  it('redacts nested fields, header pairs and embedded JSON without mutating input', () => {
    const input = {
      headers: [
        { name: 'Authorization', value: 'Bearer secret' },
        { key: 'api_key', value: 'key' },
      ],
      body: JSON.stringify({ password: 'secret', nested: { refreshToken: 'token' } }),
      nested: { password: 'hidden', count: 2, empty: null },
    };
    const original = structuredClone(input);
    const result = redact(input);
    expect(result.headers.map(header => header.value)).toEqual([REDACTED_KEYWORD, REDACTED_KEYWORD]);
    expect(JSON.parse(result.body)).toEqual({ password: REDACTED_KEYWORD, nested: { refreshToken: REDACTED_KEYWORD } });
    expect(result.nested).toEqual({ password: REDACTED_KEYWORD, count: 2, empty: null });
    expect(input).toEqual(original);
  });

  it('redacts numeric passcodes and structured secret values', () => {
    expect(
      redact({
        otp: 123456,
        secret: ['first', 'second'],
        password: { text: 'secret' },
        header: { name: 'api-key', value: 123 },
      }),
    ).toEqual({
      otp: REDACTED_KEYWORD,
      secret: REDACTED_KEYWORD,
      password: REDACTED_KEYWORD,
      header: { name: 'api-key', value: REDACTED_KEYWORD },
    });
  });

  it('preserves explicitly allowed fields and ordinary diagnostic values', () => {
    const input = {
      username: 'alice',
      email: 'alice@example.com',
      created_at: 'today',
      message: 'request failed',
      value: 'hello',
      empty: '',
      count: 0,
      enabled: false,
    };
    expect(redact(input)).toEqual(input);
    expect(redact(null)).toBeNull();
    expect(redact(undefined)).toBeUndefined();
    expect(redact(0)).toBe(0);
  });

  it('handles malformed JSON and multiple keyed patterns', () => {
    expect(redact('{ password="hidden"')).toBe(`{ password="${REDACTED_KEYWORD}"`);
    expect(redact('client_secret=abcdefghijklmnop api_key=qrstuvwxyzabcdef')).not.toMatch(
      /abcdefghijklmnop|qrstuvwxyzabcdef/,
    );
  });

  it('keeps the existing local-development opt-out separate from the forced AI boundary', () => {
    const input = { uuid: 'same', password: 'local-secret' };
    expect(deepRedactSensitiveInfo(input, 'http://localhost:3000')).toBe(input);
    expect(redact(input).password).toBe(REDACTED_KEYWORD);
  });

  it.each([
    'https://example.com/?redirect=localhost',
    'https://example.com/localhost',
    'https://localhost.example.com',
    'https://notlocalhost.com',
    'not a URL',
  ])('does not bypass redaction for remote or invalid URL %s', url => {
    expect(deepRedactSensitiveInfo({ password: 'secret' }, url).password).toBe(REDACTED_KEYWORD);
  });

  it('redacts sensitive name/value contexts while retaining their labels', () => {
    expect(redact({ name: 'password', value: 'secret' })).toEqual({ name: 'password', value: REDACTED_KEYWORD });
    expect(redact({ label: 'password', value: 'plain text' })).toEqual({ label: 'password', value: REDACTED_KEYWORD });
    expect(redact('[{"token":"secret"}]')).toBe(JSON.stringify([{ token: REDACTED_KEYWORD }]));
  });
});
