export const base64ToFile = (base64: string, fileName: string): File => {
  const commaIndex = base64.indexOf(',');
  const header = commaIndex !== -1 ? base64.slice(0, commaIndex) : '';
  const payload = commaIndex !== -1 ? base64.slice(commaIndex + 1) : base64;
  const mimeType = (header.startsWith('data:') && header.slice(5).split(';')[0]?.trim()) || 'image/png';

  const byteString = atob(payload);
  const arrayBuffer = new ArrayBuffer(byteString.length);
  const uintArray = new Uint8Array(arrayBuffer);

  for (let i = 0; i < byteString.length; i++) {
    uintArray[i] = byteString.charCodeAt(i);
  }

  const ext = mimeType.replace(/^image\//, '') || 'png';
  const cleanName = fileName.endsWith(`.${ext}`) ? fileName.slice(0, -(ext.length + 1)) : fileName;

  return new File([arrayBuffer], `${cleanName}.${ext}`, { type: mimeType });
};
