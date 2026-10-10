const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpeg',
  'image/jpg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/gif': 'gif',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
};

const EXT_ALIASES: Record<string, string[]> = {
  jpeg: ['jpeg', 'jpg'],
  jpg: ['jpeg', 'jpg'],
  ico: ['ico', 'icon'],
};

export const base64ToFile = (base64: string, fileName: string): File => {
  const commaIndex = base64.indexOf(',');
  const header = commaIndex !== -1 ? base64.slice(0, commaIndex) : '';
  const payload = commaIndex !== -1 ? base64.slice(commaIndex + 1) : base64;
  const mimeType = (header.startsWith('data:') && header.slice(5).split(';')[0]?.trim().toLowerCase()) || 'image/png';

  const byteString = atob(payload.trim().replace(/\s/g, ''));
  const arrayBuffer = new ArrayBuffer(byteString.length);
  const uintArray = new Uint8Array(arrayBuffer);

  for (let i = 0; i < byteString.length; i++) {
    uintArray[i] = byteString.charCodeAt(i);
  }

  const ext = MIME_TO_EXT[mimeType] || mimeType.replace(/^image\//, '') || 'png';
  const aliases = EXT_ALIASES[ext] ?? [ext];

  let cleanName = fileName;
  for (const alias of aliases) {
    if (cleanName.toLowerCase().endsWith(`.${alias}`)) {
      cleanName = cleanName.slice(0, -(alias.length + 1));
      break;
    }
  }

  return new File([arrayBuffer], `${cleanName}.${ext}`, { type: mimeType });
};
