export const base64ToFile = (base64: string, fileName: string) => {
  const commaIndex = base64.indexOf(',');
  const header = commaIndex !== -1 ? base64.slice(0, commaIndex) : '';
  const payload = commaIndex !== -1 ? base64.slice(commaIndex + 1) : base64;
  const byteString = atob(payload);
  const mimeType = header.startsWith('data:') ? header.slice(5).split(';')[0].trim() || 'image/png' : 'image/png';
  const arrayBuffer = new ArrayBuffer(byteString.length);
  const uintArray = new Uint8Array(arrayBuffer);

  for (let i = 0; i < byteString.length; i++) {
    uintArray[i] = byteString.charCodeAt(i);
  }

  const extension = mimeType.replace(/^image\//, '') || 'png';
  return new File([arrayBuffer], `${fileName}.${extension}`, { type: mimeType });
};
