import type { MemoryInfo } from '@src/interfaces/events';

/** Returns memory usage info (if supported). */
export const getMemoryInfo = (): MemoryInfo | null => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const memory = (performance as any).memory;
  return memory
    ? {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
      }
    : null;
};
