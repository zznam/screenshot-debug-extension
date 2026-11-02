import type { Page } from '@playwright/test';

const seedWorkspace = async (page: Page, extensionId: string) => {
  await page.goto(`chrome-extension://${extensionId}/library/index.html`);
  await page.locator('.library-empty').waitFor();
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('screenshot_debug_library_v1', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    for (const [index, width] of [800, 800, 640].entries()) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = 300;
      const context = canvas.getContext('2d')!;
      context.fillStyle = '#fff';
      context.fillRect(0, 0, width, 300);
      context.fillStyle = '#000';
      context.font = '40px Arial';
      context.fillText('HIDDEN ORIGINAL SECRET', 30, 100);
      const original = await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!)));
      context.fillStyle = '#fff';
      context.fillRect(0, 0, width, 300);
      context.fillStyle = index ? '#006600' : '#dd0000';
      context.fillRect(0, 0, 80, 60);
      context.fillStyle = '#000';
      context.font = '46px Arial';
      context.fillText('CHECKOUT UNAVAILABLE', 30, 130);
      context.font = '24px Arial';
      context.fillText('alice@example.com', 30, 220);
      const preview = await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!)));
      const id = `capture-${index}`;
      const shot = {
        id: 'shot',
        originalAssetId: `${id}-original`,
        previewAssetId: `${id}-preview`,
        annotations: { objects: [] },
        isPrimary: true,
      };
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(['captures', 'assets'], 'readwrite');
        tx.objectStore('captures').put({
          schemaVersion: 1,
          id,
          revision: 1,
          kind: 'screenshots',
          title: ['Checkout before', 'Checkout after', 'Different viewport'][index],
          tags: ['checkout'],
          source: {
            url: index === 2 ? 'https://example.com/other' : 'https://example.com/checkout?token=source-secret',
            title: 'Checkout',
            domain: 'example.com',
            capturedAt: 1000 + index,
          },
          createdAt: 1000 + index,
          updatedAt: 1000 + index,
          screenshots: [shot],
          diagnostics: [
            { recordType: 'console', message: 'alice@example.com', password: 'private-diagnostic' },
            { recordType: 'network', url: 'https://example.com/?token=secret-token' },
          ],
          sizeBytes: original.size + preview.size + 2000,
          thumbnail: canvas.toDataURL(),
          owner: 'fixture',
        });
        tx.objectStore('assets').put({ id: shot.originalAssetId, captureId: id, blob: original });
        tx.objectStore('assets').put({ id: shot.previewAssetId, captureId: id, blob: preview });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
    db.close();
  });
  await page.reload();
  await page.locator('.library-card').first().waitFor();
};

export { seedWorkspace };
