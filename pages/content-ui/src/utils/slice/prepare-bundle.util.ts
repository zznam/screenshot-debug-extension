const ACTIONABLE_EVENTS = [
  'MouseClick',
  'Click',
  'InputChange',
  'FormSubmit',
  'Navigate',
  'KeyPress',
  'KeyDown',
  'KeyUp',
  'Change',
];

export interface Bundle {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  actions: any[];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  network: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  console: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: any | null;
}

/**
 * Prepare a Bundle from mixed records.
 *
 * @param records mixed array with recordType: 'events' | 'network' | 'console' | 'metadata'
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 * @param options.range failed network status range (inclusive). Default [400, 500].
 * @param options.envOverrides optional environment fields to inject/override.
 */
export const prepareBundle = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  records: any[] = [],

  options?: {
    range?: [number, number];
    envOverrides?: Record<string, unknown>;
  },
): Bundle => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { range = [400, 599], envOverrides } = options ?? {};
  const metadata = records.find(r => r.recordType === 'events' && r.event === 'metadata') ?? null;
  const events = records.filter(r => r.recordType === 'events' && r.event !== 'metadata');

  const [minStatus, maxStatus] = range;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const network: any[] = records.filter(
    r => r.recordType === 'network' && typeof r.status === 'number' && r.status! >= minStatus && r.status! <= maxStatus,
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const consoleErrors: any[] = records.filter(
    r => r.recordType === 'console' && String(r.method).toLowerCase() === 'error',
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byTs = (a: any, b: any) => (a?.timestamp ?? 0) - (b?.timestamp ?? 0);
  events.sort(byTs);
  network.sort(byTs);
  consoleErrors.sort(byTs);

  const actions = events.filter(e => ACTIONABLE_EVENTS.includes(e.event));

  return {
    actions,
    network,
    console: consoleErrors,
    metadata: metadata,
  };
};
