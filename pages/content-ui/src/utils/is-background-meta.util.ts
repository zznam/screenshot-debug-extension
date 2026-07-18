// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { BackgroundFitMeta } from '@src/models';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isBackgroundFitMeta = (v: any) => {
  return (
    v &&
    typeof v === 'object' &&
    v.sizes?.natural &&
    Number.isFinite(v.sizes.natural.width) &&
    Number.isFinite(v.sizes.natural.height)
  );
};
