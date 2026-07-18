import type { NetworkInfo } from '@src/interfaces/events';

/** Returns connection quality details if available. */
export const getNetworkInfo = (): NetworkInfo | null => {
  const connection =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  return connection
    ? {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
      }
    : null;
};
