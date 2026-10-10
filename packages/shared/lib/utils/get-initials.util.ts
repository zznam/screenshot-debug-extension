export const getInitials = (name?: string | null): string => {
  if (typeof name !== 'string') return '';
  const trimmed = name.trim();
  if (!trimmed) return '';

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    return words[0].charAt(0).toUpperCase();
  }

  const first = words[0].charAt(0);
  const last = words[words.length - 1].charAt(0);
  return `${first}${last}`.toUpperCase();
};
