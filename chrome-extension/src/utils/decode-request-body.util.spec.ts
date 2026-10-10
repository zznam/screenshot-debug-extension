import { describe, expect, it } from 'vitest';

import { decodeRequestBody } from './decode-request-body.util';

describe('decodeRequestBody', () => {
  const encoder = new TextEncoder();

  it('returns null when requestBody or raw chunks are missing', () => {
    expect(decodeRequestBody()).toBeNull();
    expect(decodeRequestBody({})).toBeNull();
    expect(decodeRequestBody({ raw: [] })).toBeNull();
  });

  it('returns null when raw chunks contain no bytes', () => {
    expect(decodeRequestBody({ raw: [{ bytes: undefined }] })).toBeNull();
  });

  it('decodes single chunk and parses JSON body', () => {
    const payload = JSON.stringify({ action: 'login', user: 'admin' });
    const buffer = encoder.encode(payload).buffer;

    const result = decodeRequestBody({ raw: [{ bytes: buffer }] });
    expect(result).not.toBeNull();
    expect(result?.decoded).toBe(payload);
    expect(result?.parsed).toEqual({ action: 'login', user: 'admin' });
  });

  it('decodes plain text without error if not valid JSON', () => {
    const text = 'foo=bar&baz=qux';
    const buffer = encoder.encode(text).buffer;

    const result = decodeRequestBody({ raw: [{ bytes: buffer }] });
    expect(result).not.toBeNull();
    expect(result?.decoded).toBe(text);
    expect(result?.parsed).toBe(text);
  });

  it('concatenates multiple chunks in order', () => {
    const part1 = encoder.encode('{"part1":').buffer;
    const part2 = encoder.encode('"val1",').buffer;
    const part3 = encoder.encode('"part2":"val2"}').buffer;

    const result = decodeRequestBody({
      raw: [{ bytes: part1 }, { bytes: part2 }, { bytes: part3 }],
    });

    expect(result).not.toBeNull();
    expect(result?.parsed).toEqual({ part1: 'val1', part2: 'val2' });
  });
});
