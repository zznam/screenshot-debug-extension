import { readFile } from 'node:fs/promises';

import { strFromU8, unzipSync } from 'fflate';

import { expect, test } from '../fixtures/extension.js';
import { seedWorkspace } from '../fixtures/library-workspace.js';

test('reviews image pixels and selected diagnostics before exporting a usable bug report', async ({
  context,
  extensionId,
  extensionErrors,
}) => {
  const page = await context.newPage();
  await seedWorkspace(page, extensionId);
  await page.goto(`chrome-extension://${extensionId}/library/index.html?capture=capture-0&share=1`);
  await expect(page.getByRole('heading', { name: 'Review & compose report' })).toBeVisible();
  const exportZip = page.getByRole('button', { name: 'Download reviewed ZIP', exact: true });
  await expect(exportZip).toBeDisabled();
  await page.getByLabel('Steps to reproduce', { exact: true }).fill('Click the checkout button');
  await page.getByLabel('Expected behavior', { exact: true }).fill('Complete the order');
  await page.getByLabel('Actual behavior', { exact: true }).fill('An error appears for alice@example.com');
  await page.getByText('Position a mask with the keyboard').click();
  await page.getByLabel('Mask width for screenshot 1').fill('25');
  await page.getByLabel('Mask height for screenshot 1').fill('25');
  await page.getByRole('button', { name: 'Add mask', exact: true }).click();
  await page.getByLabel('Include diagnostic 1', { exact: true }).check();
  await page.getByLabel('Include source URL', { exact: true }).check();
  await page.getByLabel('I have reviewed the selected evidence').check();
  // Any subsequent change requires review again.
  await page.getByLabel('Actual behavior', { exact: true }).fill('Checkout failed for alice@example.com');
  await expect(exportZip).toBeDisabled();
  await page.getByLabel('I have reviewed the selected evidence').check();
  const [download] = await Promise.all([page.waitForEvent('download'), exportZip.click()]);
  const files = unzipSync(await readFile((await download.path())!));
  expect(Object.keys(files).sort()).toEqual(['diagnostics.json', 'report.md', 'screenshot-1.png']);
  const report = strFromU8(files['report.md']!);
  expect(report).toContain('Click the checkout button');
  expect(report).not.toMatch(/alice@example.com|source-secret/);
  const records = JSON.parse(strFromU8(files['diagnostics.json']!));
  expect(records).toHaveLength(1);
  expect(JSON.stringify(records)).not.toMatch(/alice@example.com|private-diagnostic|secret-token/);
  const pixel = await page.evaluate(async bytes => {
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/png' }));
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    return Array.from(context.getImageData(10, 10, 1, 1).data);
  }, Array.from(files['screenshot-1.png']!));
  expect(pixel).toEqual([0, 0, 0, 255]);
  // A reviewed download never modifies the saved preview or original.
  await page.goto(`chrome-extension://${extensionId}/library/index.html?capture=capture-0`);
  await expect(page.getByRole('img', { name: /screenshot 1/ })).toBeVisible();
  expect(extensionErrors).toEqual([]);
});

test('compares annotated images and explains incompatible dimensions', async ({
  context,
  extensionId,
  extensionErrors,
}) => {
  const page = await context.newPage();
  await seedWorkspace(page, extensionId);
  await page.goto(`chrome-extension://${extensionId}/library/index.html?compare=capture-0`);
  await page.getByLabel('After capture', { exact: true }).selectOption('capture-1');
  await expect(page.getByText(/% of sampled pixels differ/)).toBeVisible();
  await page.getByRole('button', { name: 'Highlight differences', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Differences highlighted in pink' })).toBeVisible();
  await page.getByLabel('After capture', { exact: true }).selectOption('capture-0');
  await expect(page.getByText('0.00% of sampled pixels differ.', { exact: false })).toBeVisible();
  await page.getByLabel('After capture', { exact: true }).selectOption('capture-2');
  await expect(page.getByText(/Image dimensions differ/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Slider', exact: true })).toBeDisabled();
  await expect(page.getByRole('img', { name: 'Before screenshot', exact: true })).toBeVisible();
  expect(extensionErrors).toEqual([]);
});

test('recognizes saved preview text offline, searches it after reload, and clears it', async ({
  context,
  extensionId,
  extensionErrors,
}) => {
  test.setTimeout(90_000);
  const page = await context.newPage();
  await seedWorkspace(page, extensionId);
  await page.goto(`chrome-extension://${extensionId}/library/index.html?capture=capture-0`);
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Read screenshot text', exact: true }).click();
  await expect(page.getByText('Text saved locally and added to library search.', { exact: true })).toBeVisible({
    timeout: 60_000,
  });
  const recognized = await page.getByLabel('Text from screenshot 1', { exact: true }).inputValue();
  expect(recognized.toUpperCase()).toContain('CHECKOUT UNAVAILABLE');
  expect(recognized).not.toContain('HIDDEN ORIGINAL');
  await page.reload();
  await expect(page.getByLabel('Text from screenshot 1', { exact: true })).toHaveValue(recognized);
  await page.getByRole('link', { name: 'All captures' }).click();
  await page.getByRole('searchbox', { name: 'Search', exact: true }).fill('unavailable');
  await expect(page.locator('.library-card')).toHaveCount(1);
  await page.locator('.library-card').click();
  await page.getByRole('button', { name: 'Clear saved text', exact: true }).click();
  await expect(page.getByText('Saved text cleared.', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'All captures' }).click();
  await page.getByRole('searchbox', { name: 'Search', exact: true }).fill('unavailable');
  await expect(page.locator('.library-card')).toHaveCount(0);
  expect(extensionErrors).toEqual([]);
});

test('cancels OCR and leaves the existing capture usable', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await seedWorkspace(page, extensionId);
  await page.goto(`chrome-extension://${extensionId}/library/index.html?capture=capture-0`);
  await page.getByRole('button', { name: 'Read screenshot text', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel text recognition', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Read screenshot text', exact: true })).toBeEnabled();
  await expect(page.getByText('Text recognition cancelled.', { exact: true })).toBeVisible();
});

test('previews bulk deletion, preserves unselected evidence, and removes all selected image assets', async ({
  context,
  extensionId,
  extensionErrors,
}) => {
  const page = await context.newPage();
  await seedWorkspace(page, extensionId);
  await page.getByRole('link', { name: 'Storage & cleanup', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Storage & cleanup', exact: true })).toBeVisible();
  await page.getByLabel('Data type', { exact: true }).selectOption('captures');
  await page.getByLabel('Title or domain', { exact: true }).fill('Checkout');
  await page.getByRole('button', { name: 'Select visible items', exact: true }).click();
  await page.getByRole('button', { name: 'Review deletion', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Delete 2 selected items?' })).toBeVisible();
  await page.getByRole('button', { name: 'Keep items', exact: true }).click();
  await page.getByRole('button', { name: 'Review deletion', exact: true }).click();
  await page.getByRole('button', { name: 'Delete selected permanently', exact: true }).click();
  await expect(page.getByText('Deleted 2 selected items.', { exact: true })).toBeVisible();
  const assets = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(resolve => {
      const request = indexedDB.open('screenshot_debug_library_v1');
      request.onsuccess = () => resolve(request.result);
    });
    return await new Promise<number>(resolve => {
      const request = db.transaction('assets').objectStore('assets').count();
      request.onsuccess = () => {
        resolve(request.result);
        db.close();
      };
    });
  });
  expect(assets).toBe(2);
  await page.getByRole('link', { name: 'All captures' }).click();
  await expect(page.locator('.library-card')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Different viewport' })).toBeVisible();
  expect(extensionErrors).toEqual([]);
});

test('keeps new tools usable at mobile, tablet and desktop widths', async ({ context, extensionId }, testInfo) => {
  const page = await context.newPage();
  await seedWorkspace(page, extensionId);
  for (const route of ['?capture=capture-0&share=1', '?compare=capture-0', '?storage=1']) {
    await page.goto(`chrome-extension://${extensionId}/library/index.html${route}`);
    await page.getByRole('heading', { level: 1 }).waitFor();
    if (route.includes('compare')) {
      await page.getByLabel('After capture', { exact: true }).selectOption('capture-1');
      await expect(page.getByText(/% of sampled pixels differ/)).toBeVisible();
    }
    for (const width of [360, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath(
          `${route.includes('share') ? 'review' : route.includes('compare') ? 'compare' : 'storage'}-${width}.png`,
        ),
        fullPage: true,
      });
    }
  }
});

test('measures AI and diagnostics storage and deletes selected records from persistence and memory', async ({
  context,
  extensionId,
  serviceWorker,
}) => {
  const page = await context.newPage();
  await seedWorkspace(page, extensionId);
  await page.goto(`chrome-extension://${extensionId}/library/index.html?storage=1`);
  await expect(page.getByLabel('Select Checkout before', { exact: true })).toBeVisible();
  // An unused tab ID gives this persisted fixture a clean memory-cache baseline;
  // the library's own resource requests may already have populated its real tab.
  const tabId = await serviceWorker.evaluate(async () => {
    const existing = new Set((await chrome.tabs.query({})).map(tab => tab.id));
    let id = 1;
    while (existing.has(id)) id++;
    return id;
  });
  await page.evaluate(async tabId => {
    const write = async (name: string, store: string, value: unknown) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(name);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).put(value);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      });
    };
    await write('screenshot_debug_ai_v1', 'sessions', {
      id: 'chat',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      context: {
        sourceId: 'fixture',
        sourceTabId: null,
        sourceTitle: 'Saved AI conversation',
        sourceUrl: 'https://example.com/chat',
        screenshotDataUrl: 'data:image/png;base64,private',
        records: [],
      },
      messages: [{ id: 'message', role: 'user', content: 'Diagnose checkout' }],
    });
    await write('screenshot_debug_records_v1', 'records', {
      uuid: 'diagnostic',
      tabId,
      timestamp: Date.now(),
      recordType: 'console',
      url: 'https://storage-cleanup.example/selected',
      message: 'Diagnostic to delete',
    });
    await write('screenshot_debug_records_v1', 'records', {
      uuid: 'keep-diagnostic',
      tabId,
      timestamp: Date.now(),
      recordType: 'console',
      url: 'https://keep.example',
      message: 'Diagnostic to preserve',
    });
    await chrome.runtime.sendMessage({ type: 'GET_RECORDS', tabId });
  }, tabId);
  await page.getByRole('button', { name: 'Refresh usage', exact: true }).click();
  await expect(page.getByLabel('Select Saved AI conversation', { exact: true })).toBeVisible();
  await page.getByLabel('Data type', { exact: true }).selectOption('diagnostics');
  await page.getByLabel('Title or domain', { exact: true }).fill('storage-cleanup.example');
  await page.getByRole('button', { name: 'Select visible items', exact: true }).click();
  await page.getByRole('button', { name: 'Review deletion', exact: true }).click();
  await page.getByRole('button', { name: 'Delete selected permanently', exact: true }).click();
  await expect(page.getByText('Deleted 1 selected items.', { exact: true })).toBeVisible();
  const remaining = (await page.evaluate(
    async tabId => (await chrome.runtime.sendMessage({ type: 'GET_RECORDS', tabId })).records,
    tabId,
  )) as { uuid: string }[];
  expect(remaining.some(record => record.uuid === 'diagnostic')).toBe(false);
  expect(remaining.some(record => record.uuid === 'keep-diagnostic')).toBe(true);
  await page.getByLabel('Data type', { exact: true }).selectOption('ai');
  await page.getByLabel('Title or domain', { exact: true }).fill('');
  await page.getByLabel('Select Saved AI conversation', { exact: true }).check();
  await page.getByRole('button', { name: 'Review deletion', exact: true }).click();
  await page.getByRole('button', { name: 'Delete selected permanently', exact: true }).click();
  await expect(page.getByLabel('Select Saved AI conversation', { exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'All captures' }).click();
  await expect(page.locator('.library-card')).toHaveCount(3);
});
