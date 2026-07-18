// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const startPerformanceObserver = (callback: (metric: any) => void) => {
  if (typeof PerformanceObserver === 'undefined') return;

  const observer = new PerformanceObserver(list => {
    for (const entry of list.getEntries()) {
      if (entry.entryType === 'largest-contentful-paint') {
        callback({
          type: 'lcp',
          name: 'Largest Contentful Paint',
          value: entry.startTime,
          timestamp: Date.now(),
        });
      } else if (entry.entryType === 'layout-shift') {
        callback({
          type: 'cls',

          name: 'Cumulative Layout Shift',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          value: (entry as any).value,
          timestamp: Date.now(),
        });
      } else if (entry.entryType === 'event' || entry.entryType === 'first-input') {
        callback({
          type: 'fid',
          name: 'First Input Delay',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          value: (entry as any).processingStart - entry.startTime,
          timestamp: Date.now(),
        });
      }
    }
  });

  try {
    observer.observe({ type: 'largest-contentful-paint', buffered: true });
    observer.observe({ type: 'layout-shift', buffered: true });
    observer.observe({ type: 'first-input', buffered: true });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (e) {
    // Ignore unsupported entry types
  }
};
