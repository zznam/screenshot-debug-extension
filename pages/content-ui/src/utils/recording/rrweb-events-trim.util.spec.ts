import type { eventWithTime } from '@rrweb/types';
import { describe, expect, it } from 'vitest';

import { buildEventsFile } from './build-rrweb-events-file.util';
import { trimRrwebEvents } from './rrweb-events-trim.util';

const event = (type: number, timestamp: number, data: unknown = {}) => ({ type, timestamp, data }) as eventWithTime;

describe('Rewind export trimming', () => {
  it('preserves distinct incremental events at the same timestamp while deduplicating anchors', () => {
    const meta = event(4, 100);
    const snapshot = event(2, 100);
    const first = event(3, 110, { text: 'first' });
    const second = event(3, 110, { text: 'second' });
    const result = trimRrwebEvents([second, snapshot, meta, first], { start: 100, end: 110 });
    expect(result).toEqual({ trimmedEvents: [meta, snapshot, second, first], fromTimestamp: 100, toTimestamp: 110 });
  });

  it('keeps the latest preceding replay anchors and normalizes reversed bounds', () => {
    const events = [event(4, 1), event(2, 2), event(2, 3), event(3, 8), event(3, 12), event(3, 20)];
    const original = [...events];
    expect(trimRrwebEvents(events, { start: 15, end: 10 })).toEqual({
      trimmedEvents: [events[0], events[2], events[4]],
      fromTimestamp: 10,
      toTimestamp: 15,
    });
    expect(events).toEqual(original);
  });

  it('handles absent anchors, malformed events, empty input, and invalid ranges', () => {
    const valid = event(3, 12);
    const malformed = [null, {}, { type: 3, timestamp: NaN }] as unknown as eventWithTime[];
    expect(trimRrwebEvents([...malformed, valid], { start: 10, end: 15 }).trimmedEvents).toEqual([valid]);
    for (const events of [null, undefined, [], malformed]) {
      expect(trimRrwebEvents(events, { start: 10, end: 15 })).toEqual({
        trimmedEvents: [],
        fromTimestamp: 0,
        toTimestamp: 0,
      });
    }
    expect(trimRrwebEvents([valid], null).trimmedEvents).toEqual([]);
    expect(trimRrwebEvents([valid], { start: NaN, end: 15 }).trimmedEvents).toEqual([]);
  });

  it('writes usable time bounds and all same-millisecond mutations into events.json', async () => {
    const events = [event(4, 100), event(2, 100), event(3, 110, { id: 1 }), event(3, 110, { id: 2 })];
    const file = await buildEventsFile({ events, range: { start: 100, end: 110 } });
    const payload = JSON.parse(await file.text());
    expect(file.name).toBe('events.json');
    expect(payload).toMatchObject({
      schemaVersion: 1,
      trim: { fromTimestamp: 100, toTimestamp: 110 },
      events,
      diagnostics: { originalCount: 4, trimmedCount: 4, hasMeta: true, hasFullSnapshot: true },
    });
  });

  it('sorts untrimmed exports without inventing a time range', async () => {
    const events = [event(3, 10), event(2, 1), event(4, 1)];
    const file = await buildEventsFile({ events });
    expect(JSON.parse(await file.text())).toEqual({
      schemaVersion: 1,
      trim: null,
      events: [events[2], events[1], events[0]],
      diagnostics: null,
    });
  });
});
