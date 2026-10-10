import { saveAs } from 'file-saver';

import { base64ToBlob } from './base64-to-blob.util';

export const saveBase64Image = async (b64: string, filename = 'screenshot') => {
  const blob = await base64ToBlob(b64);
  const ext = blob.type.replace(/^image\//, '') || 'png';
  const cleanName = filename.endsWith(`.${ext}`) ? filename.slice(0, -(ext.length + 1)) : filename;
  saveAs(blob, `${cleanName}.${ext}`);
};
