/**
 * Fills `{date}` and `{host}` in the saved Downloads subfolder. The template was already
 * normalized when saved; the substituted values contain only digits, letters, dots and
 * hyphens, so the result stays a safe relative path.
 */
/** Drops leading and trailing dots and hyphens without a backtracking regex. */
const trimDotsAndHyphens = (value: string) => {
  let start = 0;
  let end = value.length;
  while (start < end && (value[start] === '.' || value[start] === '-')) start++;
  while (end > start && (value[end - 1] === '.' || value[end - 1] === '-')) end--;
  return value.slice(start, end);
};

export const expandDownloadFolder = (template: string, capture: { timestamp: number; host: string }): string => {
  if (!template.includes('{')) return template;
  const when = new Date(Number.isFinite(capture.timestamp) ? capture.timestamp : Date.now());
  const date = [when.getFullYear(), when.getMonth() + 1, when.getDate()]
    .map((part, index) => String(part).padStart(index === 0 ? 4 : 2, '0'))
    .join('-');
  const host =
    trimDotsAndHyphens(
      capture.host
        .slice(0, 253)
        .toLowerCase()
        .replace(/:\d{1,5}$/, '')
        .replace(/[^a-z0-9.-]/g, '-'),
    ) || 'unknown-site';
  return template.replace(/\{date\}/gi, date).replace(/\{host\}/gi, host);
};
