export const capitalizeWord = (word?: string | null): string => {
  if (typeof word !== 'string' || !word) return '';
  const trimmed = word.trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
};
