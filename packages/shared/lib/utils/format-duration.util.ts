/**
 * Format a duration in milliseconds as M:SS or H:MM:SS (if duration is 1 hour or more).
 *
 * @param ms - Duration in milliseconds
 * @returns {string}
 */
export const formatDurationMs = (ms: number): string => {
  if (!Number.isFinite(ms) || ms <= 0) return '0:00';

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};
