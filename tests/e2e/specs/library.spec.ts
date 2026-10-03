import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { chromium } from '@playwright/test';
import type { BrowserContext, Worker } from '@playwright/test';

import { drawRectangle } from '../fixtures/annotations.js';
import { expect, test } from '../fixtures/extension.js';

const captureViewport = async (context: BrowserContext, worker: Worker, suffix: string) => {
  const page = await context.newPage();
  const url = `http://127.0.0.1:4174/?library-${suffix}`;
  await page.goto(url);
  await expect(page.locator('#brie-root')).toHaveCount(1);
  await worker.evaluate(async source => {
    const tab = (await chrome.tabs.query({})).find(item => item.url === source)!;
    await chrome.tabs.update(tab.id!, { active: true });
    await chrome.tabs.sendMessage(tab.id!, { action: 'START_SCREENSHOT', payload: { type: 'viewport' } });
  }, url);
  await expect(page.getByTestId('screenshot-editor')).toBeVisible();
  return page;
};

test('saves annotated evidence, reopens after the source closes, and searches renamed captures', async ({
  context,
  serviceWorker,
  extensionId,
  extensionErrors,
}, testInfo) => {
  const page = await captureViewport(context, serviceWorker, 'manual');
  await page.getByRole('button', { name: 'Save manually', exact: true }).click();
  await drawRectangle(page);
  await page.getByRole('button', { name: 'Save to library', exact: true }).click();
  await expect(page.getByText('Saved to your local library.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Minimize', exact: true }).click();
  await page.locator('#brie-minimized-preview').hover();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.getByTestId('screenshot-editor')).toBeVisible();
  const saveAgain = page.getByRole('button', { name: 'Save to library', exact: true });
  if (await saveAgain.count()) {
    await saveAgain.click();
    await expect(page.getByText('Saved to your local library.', { exact: true })).toBeVisible();
  }
  await page.close();
  const library = await context.newPage();
  await library.goto(`chrome-extension://${extensionId}/library/index.html`);
  await expect(library.locator('.library-card')).toHaveCount(1);
  await library.getByRole('searchbox', { name: 'Search' }).focus();
  await library.keyboard.press('Tab');
  await expect(library.getByRole('combobox', { name: 'Domain', exact: true })).toBeFocused();
  await library.locator('.library-card').focus();
  await library.keyboard.press('Enter');
  await expect(library.getByRole('img', { name: /screenshot 1/ })).toBeVisible();
  await library.getByLabel('Title', { exact: true }).fill('Checkout button is broken');
  await library.getByLabel('Tags', { exact: true }).fill('checkout, mobile');
  await library.getByRole('button', { name: 'Save details' }).click();
  await expect(library.getByText('Changes saved.')).toBeVisible();
  await library.getByRole('link', { name: 'All captures' }).click();
  await library.getByRole('searchbox', { name: 'Search' }).fill('MOBILE');
  await expect(library.locator('.library-card')).toHaveCount(1);
  await library.getByRole('searchbox', { name: 'Search' }).fill('missing tag');
  await expect(library.getByText('No matching captures')).toBeVisible();
  await library.getByRole('button', { name: 'Clear filters' }).click();
  for (const width of [360, 768, 1280]) {
    await library.setViewportSize({ width, height: 900 });
    expect(await library.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await library.screenshot({ path: testInfo.outputPath(`library-${width}.png`), fullPage: true });
  }
  await library.locator('.library-card').click();
  await library.getByRole('button', { name: 'Delete capture', exact: true }).click();
  await library.getByRole('button', { name: 'Delete permanently' }).click();
  await expect(library.getByText('Your next capture belongs here')).toBeVisible();
  expect(extensionErrors).toEqual([]);
});

test('keeps successive captures from the same source tab as separate library entries', async ({
  context,
  serviceWorker,
  extensionId,
}) => {
  const page = await captureViewport(context, serviceWorker, 'successive');
  await page.getByRole('button', { name: 'Save manually', exact: true }).click();
  await page.getByRole('button', { name: 'Save to library', exact: true }).click();
  await expect(page.getByText('Saved to your local library.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Minimize', exact: true }).click();
  await serviceWorker.evaluate(async () => {
    const tab = (await chrome.tabs.query({ active: true }))[0]!;
    await chrome.tabs.sendMessage(tab.id!, { action: 'START_SCREENSHOT', payload: { type: 'viewport' } });
  });
  await expect(page.getByTestId('screenshot-editor')).toBeVisible();
  await page.getByRole('button', { name: 'Save to library', exact: true }).click();
  await expect(page.getByText('Saved to your local library.', { exact: true })).toBeVisible();
  const library = await context.newPage();
  await library.goto(`chrome-extension://${extensionId}/library/index.html`);
  await expect(library.locator('.library-card')).toHaveCount(2);
});

test('automatically saves once, updates annotations, and keeps capture data across a browser restart', async ({
  headless,
}, testInfo) => {
  test.setTimeout(90_000);
  const profile = await mkdtemp(join(tmpdir(), 'capture-library-test-'));
  const extension = resolve(import.meta.dirname, '../../..', 'dist');
  const launch = () =>
    chromium.launchPersistentContext(profile, {
      channel: 'chromium',
      headless,
      args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
    });
  let context = await launch();
  try {
    let worker = context.serviceWorkers()[0];
    worker ??= await context.waitForEvent('serviceworker', { timeout: 15_000 });
    const extensionId = new URL(worker.url()).host;
    const page = await captureViewport(context, worker, 'automatic');
    await page.getByRole('button', { name: 'Save automatically', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
    await drawRectangle(page);
    await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Minimize', exact: true }).click();
    await page.locator('#brie-minimized-preview').waitFor();
    await page.evaluate(() => {
      const src = document
        .querySelector('#brie-root')!
        .shadowRoot!.querySelector<HTMLImageElement>('#brie-minimized-preview img')!.src;
      window.dispatchEvent(
        new CustomEvent('STORE_SCREENSHOT', {
          detail: { screenshots: [{ id: crypto.randomUUID(), src, isPrimary: false }] },
        }),
      );
    });
    await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
    await context.close();
    context = await launch();
    const library = await context.newPage();
    await library.goto(`chrome-extension://${extensionId}/library/index.html`);
    await expect(library.locator('.library-card')).toHaveCount(1);
    await library.locator('.library-card').click();
    await expect(library.getByRole('img', { name: /screenshot 1/ })).toBeVisible();
    const savedDocument = await library.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('screenshot_debug_library_v1');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const capture = await new Promise<{ revision: number; screenshots: { annotations: { objects: unknown[] } }[] }>(
        resolve => {
          const request = db.transaction('captures').objectStore('captures').getAll();
          request.onsuccess = () => resolve(request.result[0]);
        },
      );
      db.close();
      return capture;
    });
    expect(savedDocument.revision).toBeGreaterThanOrEqual(2);
    expect(savedDocument.screenshots).toHaveLength(2);
    expect(savedDocument.screenshots[0]!.annotations.objects.length).toBeGreaterThan(0);
    await library.screenshot({ path: testInfo.outputPath('restored-capture.png'), fullPage: true });
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});
