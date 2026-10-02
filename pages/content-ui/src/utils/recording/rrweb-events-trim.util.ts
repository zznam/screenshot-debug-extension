import type { eventWithTime } from '@rrweb/types';

import type { TrimRange } from '@src/models';

type RrwebEvent = eventWithTime & { type: number; timestamp: number };

export const RRWEB_META_EVENT_TYPE = 4;
export const RRWEB_FULL_SNAPSHOT_EVENT_TYPE = 2;

export const safeIsRrwebEvent = (candidate: unknown): candidate is RrwebEvent => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyCandidate = candidate as any;
  return (
    !!anyCandidate &&
    typeof anyCandidate === 'object' &&
    typeof anyCandidate.timestamp === 'number' &&
    Number.isFinite(anyCandidate.timestamp) &&
    typeof anyCandidate.type === 'number'
  );
};

export const sortByTime = (a: RrwebEvent, b: RrwebEvent) => {
  if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;

  const rank = (e: RrwebEvent) =>
    e.type === RRWEB_META_EVENT_TYPE ? 0 : e.type === RRWEB_FULL_SNAPSHOT_EVENT_TYPE ? 1 : 2;

  return rank(a) - rank(b);
};

export const findLastAnchorBeforeOrAt = (
  sortedEvents: RrwebEvent[],
  type: number,
  atTimestamp: number,
): RrwebEvent | null => {
  for (let index = sortedEvents.length - 1; index >= 0; index -= 1) {
    const event = sortedEvents[index]!;
    if (event.timestamp <= atTimestamp && event.type === type) return event;
  }
  return null;
};

export const trimRrwebEvents = (events: eventWithTime[] | null | undefined, range: TrimRange | null) => {
  if (!Array.isArray(events) || !range || !Number.isFinite(range.start) || !Number.isFinite(range.end)) {
    return { trimmedEvents: [] as RrwebEvent[], fromTimestamp: 0, toTimestamp: 0 };
  }

  const allSorted = events.filter(safeIsRrwebEvent).slice().sort(sortByTime);
  if (allSorted.length === 0) return { trimmedEvents: [] as RrwebEvent[], fromTimestamp: 0, toTimestamp: 0 };

  const start = Math.min(range.start, range.end);
  const end = Math.max(range.start, range.end);

  const windowEvents = allSorted.filter(e => e.timestamp >= start && e.timestamp <= end);

  // anchors at/ before fromTimestamp
  const prefix: RrwebEvent[] = [];

  const meta = findLastAnchorBeforeOrAt(allSorted, RRWEB_META_EVENT_TYPE, start);
  if (meta) prefix.push(meta);

  const snapshot = findLastAnchorBeforeOrAt(allSorted, RRWEB_FULL_SNAPSHOT_EVENT_TYPE, start);
  if (snapshot) prefix.push(snapshot);

  // Only anchors are duplicated by the prefix. Distinct incremental events can
  // share both type and timestamp and must all survive for replay to be correct.
  const anchors = new Set<string>();
  const combined = [...prefix, ...windowEvents].sort(sortByTime).filter(event => {
    if (event.type !== RRWEB_META_EVENT_TYPE && event.type !== RRWEB_FULL_SNAPSHOT_EVENT_TYPE) return true;
    const key = `${event.type}:${event.timestamp}`;
    if (anchors.has(key)) return false;
    anchors.add(key);
    return true;
  });

  return { trimmedEvents: combined, fromTimestamp: start, toTimestamp: end };
};
