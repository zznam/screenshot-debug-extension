// Bound the output bitmap before html2canvas allocates it. These are deliberately
// conservative product limits, not claims about each browser's canvas maximum.
const MAX_PIXELS = 16_000_000;
const MAX_SIDE = 16_384;
const MIN_SCALE = 0.5;

export const fullPageSize = (width: number, height: number, pixelRatio: number) => {
  if (![width, height].every(value => Number.isFinite(value) && value > 0)) {
    throw new Error('This page has no capturable area. Try a viewport capture.');
  }
  const ratio = Number.isFinite(pixelRatio) && pixelRatio > 0 ? Math.max(1, pixelRatio) : 1;
  const scale = Math.min(ratio, 2, MAX_SIDE / width, MAX_SIDE / height, Math.sqrt(MAX_PIXELS / width / height));
  if (scale < MIN_SCALE) {
    throw new Error(
      'This page is too large for a readable full-page image. Capture the viewport or a selected area instead.',
    );
  }
  return { width, height, scale };
};
