export const base64ToBlob = (data: string, type = 'image/png'): Blob => {
  const commaIndex = data.indexOf(',');
  const header = commaIndex !== -1 ? data.slice(0, commaIndex) : '';
  const payload = commaIndex !== -1 ? data.slice(commaIndex + 1) : data;
  const mimeType = (header.startsWith('data:') && header.slice(5).split(';')[0]?.trim()) || type;

  // Decode base64 string
  const byteCharacters = atob(payload);

  // Create byte array
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }

  // Convert byte array to Blob
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
};
