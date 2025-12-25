import { saveAs } from 'file-saver';

import { base64ToBlob } from '../base64-to-blob.util';

export const exportToPng = (name: string) => {
  const canvas = document.querySelector('canvas');

  if (!canvas) {
    return;
  }

  const base64 = canvas.toDataURL('png', 1).replace('data:image/png;base64,', '');

  saveAs(base64ToBlob(base64, 'image/png'), name);
};
