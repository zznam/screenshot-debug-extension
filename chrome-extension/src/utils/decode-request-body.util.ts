export const decodeRequestBody = (requestBody?: {
  raw?: Array<{ bytes?: ArrayBuffer | ArrayBufferLike }>;
}): { decoded: string; parsed: unknown } | null => {
  if (!requestBody?.raw?.length) return null;

  try {
    const validByteArrays: Uint8Array[] = [];

    for (const chunk of requestBody.raw) {
      if (chunk?.bytes instanceof ArrayBuffer) {
        validByteArrays.push(new Uint8Array(chunk.bytes));
      } else if (chunk?.bytes && ArrayBuffer.isView(chunk.bytes)) {
        const view = chunk.bytes as ArrayBufferView;
        validByteArrays.push(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
      } else if (chunk?.bytes && typeof (chunk.bytes as { byteLength?: number }).byteLength === 'number') {
        validByteArrays.push(new Uint8Array(chunk.bytes as unknown as ArrayBuffer));
      }
    }

    if (validByteArrays.length === 0) return null;

    let combined: Uint8Array;
    if (validByteArrays.length === 1) {
      combined = validByteArrays[0];
    } else {
      const totalLength = validByteArrays.reduce((acc, curr) => acc + curr.byteLength, 0);
      combined = new Uint8Array(totalLength);
      let offset = 0;
      for (const arr of validByteArrays) {
        combined.set(arr, offset);
        offset += arr.byteLength;
      }
    }

    const decoded = new TextDecoder('utf-8').decode(combined);

    let parsed: unknown = decoded;
    try {
      parsed = JSON.parse(decoded);
    } catch {
      // not JSON, keep as plain string
    }

    return { decoded, parsed };
  } catch (e) {
    console.warn('[decodeRequestBody] Failed to decode request body:', e);
    return null;
  }
};
