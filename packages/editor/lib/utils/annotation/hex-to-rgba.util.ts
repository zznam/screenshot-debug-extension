export const hexToRgba = (hex: string, alpha = 1): string => {
  if (typeof hex !== 'string') {
    return 'rgba(0,0,0,1)';
  }

  const cleanHex = hex.trim().replace(/^#/, '');
  const safeAlpha = Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 1;

  // Handle 3-digit (#rgb) and 4-digit (#rgba) shorthand
  let fullHex = cleanHex;
  if (cleanHex.length === 3 || cleanHex.length === 4) {
    fullHex = cleanHex
      .split('')
      .map(char => char + char)
      .join('');
  }

  if (!/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(fullHex)) {
    return `rgba(0,0,0,${safeAlpha})`;
  }

  const r = parseInt(fullHex.slice(0, 2), 16);
  const g = parseInt(fullHex.slice(2, 4), 16);
  const b = parseInt(fullHex.slice(4, 6), 16);

  let finalAlpha = safeAlpha;
  if (fullHex.length === 8 && alpha === 1) {
    const hexAlpha = parseInt(fullHex.slice(6, 8), 16) / 255;
    finalAlpha = Math.round(hexAlpha * 100) / 100;
  }

  return `rgba(${r},${g},${b},${finalAlpha})`;
};
