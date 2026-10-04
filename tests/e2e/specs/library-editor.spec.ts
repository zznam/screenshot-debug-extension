import type { Page } from '@playwright/test';

import { drawRectangle } from '../fixtures/annotations.js';
import { expect, test } from '../fixtures/extension.js';

const seedLibrary = async (page: Page, extensionId: string) => {
  await page.goto(`chrome-extension://${extensionId}/library/index.html`);
  await expect(page.getByText('Your next capture belongs here')).toBeVisible();
  await page.evaluate(async () => {
    await chrome.storage.local.set({ 'library-save-mode': 'manual' });
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 500;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#f5f7fc';
    ctx.fillRect(0, 0, 800, 500);
    ctx.fillStyle = '#173e79';
    ctx.font = '28px sans-serif';
    ctx.fillText('Saved capture • source tab closed', 30, 90);
    ctx.fillStyle = '#bfd7f3';
    ctx.fillRect(30, 160, 740, 260);
    const src = canvas.toDataURL('image/png');
    const blob = await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!), 'image/png'));
    const db = await new Promise<IDBDatabase>(resolve => {
      const request = indexedDB.open('screenshot_debug_library_v1');
      request.onsuccess = () => resolve(request.result);
    });
    const tx = db.transaction(['captures', 'assets'], 'readwrite');
    for (const id of ['first', 'second']) {
      tx.objectStore('assets').put({ id: `${id}-original`, captureId: id, blob });
      tx.objectStore('assets').put({ id: `${id}-preview`, captureId: id, blob });
      tx.objectStore('captures').put({
        schemaVersion: 1,
        id,
        owner: 'seed',
        kind: 'screenshots',
        revision: 1,
        title: `${id} saved capture`,
        tags: ['editor'],
        source: {
          url: 'https://closed.example/checkout',
          title: 'Frozen source',
          domain: 'closed.example',
          capturedAt: 1,
        },
        createdAt: 1,
        updatedAt: 1,
        sizeBytes: blob.size * 2,
        thumbnail: src,
        screenshots: [
          {
            id: 'same-shot-id',
            originalAssetId: `${id}-original`,
            previewAssetId: `${id}-preview`,
            isPrimary: true,
            annotations: {
              objects: [
                {
                  type: 'Rect',
                  version: '6.6.7',
                  objectId: 'saved-shape',
                  shapeType: 'rectangle',
                  left: 650,
                  top: 350,
                  width: 90,
                  height: 80,
                  fill: 'transparent',
                  stroke: '#ef4444',
                  strokeWidth: 3,
                },
              ],
            },
          },
        ],
        diagnostics: [{ type: 'console', data: { message: 'Frozen diagnostic secret' } }],
      });
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  });
};
const evidence = (page: Page, id = 'first') =>
  page.evaluate(async id => {
    const db = await new Promise<IDBDatabase>(resolve => {
      const request = indexedDB.open('screenshot_debug_library_v1');
      request.onsuccess = () => resolve(request.result);
    });
    const read = <T>(store: string, key: string) =>
      new Promise<T>(resolve => {
        const request = db.transaction(store).objectStore(store).get(key);
        request.onsuccess = () => resolve(request.result);
      });
    const capture = await read<{
      revision: number;
      source: unknown;
      diagnostics: unknown;
      screenshots: { originalAssetId: string; previewAssetId: string; annotations: { objects: unknown[] } }[];
    }>('captures', id);
    const shot = capture.screenshots[0]!;
    const original = await read<{ blob: Blob }>('assets', shot.originalAssetId);
    const preview = await read<{ blob: Blob }>('assets', shot.previewAssetId);
    const originalBytes = Array.from(new Uint8Array(await original.blob.arrayBuffer()));
    const previewBytes = Array.from(new Uint8Array(await preview.blob.arrayBuffer()));
    db.close();
    return { capture, originalBytes, previewBytes };
  }, id);

test('edits existing layers, undoes/redoes, saves preserved originals and downloads the flattened image', async ({
  context,
  extensionId,
  extensionErrors,
}, testInfo) => {
  const page = await context.newPage();
  await seedLibrary(page, extensionId);
  const before = await evidence(page);
  const outbound: string[] = [];
  page.on('request', request => {
    if (/^https?:/.test(request.url())) outbound.push(request.url());
  });
  await page.goto(`chrome-extension://${extensionId}/library/index.html?capture=first&edit=1`);
  await expect(page.locator('[data-editor-ready="true"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'AI Debug', exact: true })).toHaveCount(0);
  const canvas = page.locator('canvas.upper-canvas');
  const frame = (await canvas.boundingBox())!;
  await canvas.click({ position: { x: frame.width * 0.86, y: frame.height * 0.78 } });
  await page.keyboard.press('Delete');
  await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toBeEnabled();
  await page.keyboard.press('Control+z');
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  await drawRectangle(page);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByText('Changes saved on this device.')).toBeVisible();
  const after = await evidence(page);
  expect(after.capture.revision).toBe(2);
  expect(after.capture.screenshots[0]!.annotations.objects).toHaveLength(2);
  expect(after.capture.screenshots[0]!.originalAssetId).toBe(before.capture.screenshots[0]!.originalAssetId);
  expect(after.originalBytes).toEqual(before.originalBytes);
  expect(after.previewBytes).not.toEqual(before.previewBytes);
  expect(after.capture.source).toEqual(before.capture.source);
  expect(after.capture.diagnostics).toEqual(before.capture.diagnostics);
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download', exact: true }).click();
  expect((await downloaded).suggestedFilename()).toMatch(/\.png$/);
  await page.getByRole('button', { name: 'Copy', exact: true }).click();
  await expect(page.getByText('Screenshot copied to clipboard!')).toBeVisible();
  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`editor-${width}.png`), fullPage: true });
  }
  await page.reload();
  await expect(page.locator('[data-editor-ready="true"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start over', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Start over', exact: true }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  expect(outbound).toEqual([]);
  expect(extensionErrors).toEqual([]);
});

test('isolates concurrent captures and rejects stale saves from a second editor window', async ({
  context,
  extensionId,
  extensionErrors,
}) => {
  const first = await context.newPage();
  await seedLibrary(first, extensionId);
  const second = await context.newPage();
  await first.goto(`chrome-extension://${extensionId}/library/index.html?capture=first&edit=1`);
  await second.goto(`chrome-extension://${extensionId}/library/index.html?capture=second&edit=1`);
  await drawRectangle(first);
  await drawRectangle(second);
  await first.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(first.getByText('Changes saved on this device.')).toBeVisible();
  await first.close();
  await second.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(second.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  await second.getByRole('button', { name: 'Redo', exact: true }).click();
  await second.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(second.getByText('Changes saved on this device.')).toBeVisible();
  expect((await evidence(second, 'second')).capture.screenshots[0]!.annotations.objects).toHaveLength(2);
  const stale = await context.newPage();
  await stale.goto(`chrome-extension://${extensionId}/library/index.html?capture=second&edit=1`);
  await drawRectangle(stale);
  await second.getByRole('button', { name: 'Start over', exact: true }).click();
  await second.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(second.getByText('Changes saved on this device.')).toBeVisible();
  await stale.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(stale.getByRole('alert')).toContainText('changed in another window');
  expect((await evidence(second, 'second')).capture.screenshots[0]!.annotations.objects).toHaveLength(0);
  const downloaded = stale.waitForEvent('download');
  await stale.getByRole('button', { name: 'Download', exact: true }).click();
  await downloaded;
  stale.once('dialog', dialog => dialog.accept());
  await stale.getByRole('button', { name: 'Reload saved version' }).click();
  await expect(stale.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  expect(extensionErrors).toEqual([]);
});

test('preserves unsaved edits after quota failure, retries, and respects automatic saving', async ({
  context,
  extensionId,
  extensionErrors,
}) => {
  const page = await context.newPage();
  await seedLibrary(page, extensionId);
  await page.goto(`chrome-extension://${extensionId}/library/index.html?capture=first&edit=1`);
  const before = await evidence(page);
  await drawRectangle(page);
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value: unknown, key?: IDBValidKey) {
      if (this.name === 'assets') throw new DOMException('Full', 'QuotaExceededError');
      return put.call(this, value, key);
    };
    (window as unknown as { restoreLibraryWrites: () => void }).restoreLibraryWrites = () => {
      IDBObjectStore.prototype.put = put;
    };
  });
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Not enough storage');
  expect(await evidence(page)).toEqual(before);
  await page.evaluate(() => (window as unknown as { restoreLibraryWrites: () => void }).restoreLibraryWrites());
  await page.getByRole('button', { name: 'Retry save', exact: true }).click();
  await expect(page.getByText('Changes saved on this device.')).toBeVisible();
  await page.evaluate(() => chrome.storage.local.set({ 'library-save-mode': 'automatic' }));
  await expect(page.getByText('Edits save automatically. Original images stay intact.')).toBeVisible();
  await page.getByRole('button', { name: 'Start over', exact: true }).click();
  await expect.poll(async () => (await evidence(page)).capture.revision).toBe(3);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  expect((await evidence(page)).capture.screenshots[0]!.annotations.objects).toHaveLength(0);
  expect(extensionErrors).toEqual([]);
});
