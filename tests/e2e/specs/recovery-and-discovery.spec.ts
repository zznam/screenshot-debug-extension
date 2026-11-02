import { expect, test } from '../fixtures/extension.js';
import { seedWorkspace } from '../fixtures/library-workspace.js';

test('combines capture filters, restores them after reload, and recovers from invalid dates', async ({
  context,
  extensionId,
  extensionErrors,
}) => {
  const page = await context.newPage();
  await seedWorkspace(page, extensionId);
  await page.getByRole('searchbox', { name: 'Search', exact: true }).fill('before');
  await page.getByRole('combobox', { name: 'Domain', exact: true }).selectOption('example.com');
  await page.getByRole('combobox', { name: 'Type', exact: true }).selectOption('screenshots');
  await page.getByLabel('From', { exact: true }).fill('1969-12-31');
  await page.getByLabel('To', { exact: true }).fill('1970-01-02');
  await expect(page.locator('.library-card')).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole('searchbox', { name: 'Search', exact: true })).toHaveValue('before');
  await expect(page.getByRole('combobox', { name: 'Domain', exact: true })).toHaveValue('example.com');
  await expect(page.getByRole('combobox', { name: 'Type', exact: true })).toHaveValue('screenshots');
  await expect(page.getByLabel('From', { exact: true })).toHaveValue('1969-12-31');
  await expect(page.locator('.library-card')).toHaveCount(1);
  await page.getByLabel('From', { exact: true }).fill('2026-01-01');
  await expect(page.getByRole('alert')).toContainText('Choose an end date on or after the start date.');
  await expect(page.getByRole('heading', { name: 'No matching captures' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(page.locator('.library-card')).toHaveCount(3);
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(extensionErrors).toEqual([]);
});

test('explains missing captures and missing image assets while keeping library navigation available', async ({
  context,
  extensionId,
  extensionErrors,
}) => {
  const page = await context.newPage();
  await seedWorkspace(page, extensionId);
  await page.goto(`chrome-extension://${extensionId}/library/index.html?capture=missing-capture`);
  await expect(page.getByRole('alert')).toHaveText('This capture no longer exists.');
  await page.getByRole('link', { name: 'All captures', exact: false }).click();
  await expect(page.locator('.library-card')).toHaveCount(3);
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('screenshot_debug_library_v1', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('assets', 'readwrite');
      transaction.objectStore('assets').delete('capture-0-preview');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  });
  await page.goto(`chrome-extension://${extensionId}/library/index.html?capture=capture-0`);
  await expect(page.getByRole('alert')).toHaveText('A saved image is missing.');
  await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue('Checkout before');
  await page.getByRole('link', { name: 'All captures', exact: false }).click();
  await expect(page.locator('.library-card')).toHaveCount(3);
  expect(extensionErrors).toEqual([]);
});

test('moves the comparison slider with a keyboard and clears stale images when a capture is deselected', async ({
  context,
  extensionId,
  extensionErrors,
}) => {
  const page = await context.newPage();
  await seedWorkspace(page, extensionId);
  await page.goto(`chrome-extension://${extensionId}/library/index.html?compare=capture-0`);
  await page.getByRole('combobox', { name: 'After capture', exact: true }).selectOption('capture-1');
  await page.getByRole('button', { name: 'Slider', exact: true }).click();
  const slider = page.getByRole('slider', { name: 'Comparison position' });
  await slider.focus();
  await slider.press('Home');
  await expect(slider).toHaveValue('0');
  await expect(page.getByRole('img', { name: 'After screenshot', exact: true })).toHaveCSS(
    'clip-path',
    'inset(0px 0px 0px 0%)',
  );
  await slider.press('End');
  await expect(slider).toHaveValue('100');
  await expect(page.getByRole('img', { name: 'After screenshot', exact: true })).toHaveCSS(
    'clip-path',
    'inset(0px 0px 0px 100%)',
  );
  await page.getByRole('combobox', { name: 'After capture', exact: true }).selectOption('');
  await expect(page.getByText('Choose an after capture to compare saved, annotated images.')).toBeVisible();
  await expect(page.getByRole('img', { name: 'After screenshot', exact: true })).toHaveCount(0);
  expect(extensionErrors).toEqual([]);
});

test('persists capture preferences across popup windows and removes skipped domains with a keyboard', async ({
  context,
  extensionId,
  extensionErrors,
}) => {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup/index.html`);
  await popup.getByRole('button', { name: 'Settings', exact: true }).click();
  await popup.getByRole('combobox', { name: 'Save captures to library', exact: true }).selectOption('automatic');
  await popup.getByRole('combobox', { name: 'Export Format', exact: true }).selectOption('zip');
  await popup.getByRole('combobox', { name: 'Data Retention', exact: true }).selectOption('15');
  await popup.getByLabel('Include Performance Metrics', { exact: true }).check();
  await popup.getByLabel('Domain Skip List', { exact: true }).fill('https://Example.COM/a');
  await popup.getByLabel('Domain Skip List', { exact: true }).press('Enter');
  await expect(popup.getByRole('list', { name: 'Skipped domains' })).toContainText('example.com');
  await popup.close();
  const reopened = await context.newPage();
  await reopened.goto(`chrome-extension://${extensionId}/popup/index.html`);
  await reopened.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(reopened.getByRole('combobox', { name: 'Save captures to library', exact: true })).toHaveValue(
    'automatic',
  );
  await expect(reopened.getByRole('combobox', { name: 'Export Format', exact: true })).toHaveValue('zip');
  await expect(reopened.getByRole('combobox', { name: 'Data Retention', exact: true })).toHaveValue('15');
  await expect(reopened.getByLabel('Include Performance Metrics', { exact: true })).toBeChecked();
  await reopened.getByRole('button', { name: 'Remove example.com', exact: true }).focus();
  await reopened.getByRole('button', { name: 'Remove example.com', exact: true }).press('Enter');
  await expect(reopened.getByRole('list', { name: 'Skipped domains' })).toHaveCount(0);
  await reopened.reload();
  await reopened.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(reopened.getByRole('list', { name: 'Skipped domains' })).toHaveCount(0);
  expect(extensionErrors).toEqual([]);
});

test('keeps diagnostics when cleanup fails and allows a successful retry', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await seedWorkspace(page, extensionId);
  await page.goto(`chrome-extension://${extensionId}/library/index.html?storage=1`);
  await page.evaluate(() => {
    const send = chrome.runtime.sendMessage.bind(chrome.runtime);
    let failDelete = true;
    let deleted = false;
    chrome.runtime.sendMessage = ((message: { type: string }) => {
      if (message.type === 'LIBRARY_STORAGE_LIST')
        return Promise.resolve({
          status: 'success',
          data: !deleted
            ? [{ id: 'record', category: 'diagnostics', title: 'Retry this diagnostic', sizeBytes: 80, updatedAt: 1 }]
            : [],
        });
      if (message.type === 'LIBRARY_STORAGE_DELETE') {
        if (failDelete) {
          failDelete = false;
          return Promise.resolve({ status: 'error', message: 'Storage temporarily unavailable' });
        }
        deleted = true;
        return Promise.resolve({ status: 'success', data: null });
      }
      return send(message);
    }) as typeof chrome.runtime.sendMessage;
  });
  await page.getByRole('button', { name: 'Refresh usage', exact: true }).click();
  await page.getByLabel('Select Retry this diagnostic', { exact: true }).check();
  await page.getByRole('button', { name: 'Review deletion', exact: true }).click();
  await page.getByRole('button', { name: 'Delete selected permanently', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Storage temporarily unavailable');
  await expect(page.getByRole('button', { name: 'Delete selected permanently', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Review deletion', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Select Retry this diagnostic', { exact: true })).toBeVisible();
  await page.getByLabel('Select Retry this diagnostic', { exact: true }).check();
  await page.getByRole('button', { name: 'Review deletion', exact: true }).click();
  await page.getByRole('button', { name: 'Delete selected permanently', exact: true }).click();
  await expect(page.getByText('Deleted 1 selected items.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Select Retry this diagnostic', { exact: true })).toHaveCount(0);
  await expect(page.locator('.storage-row')).toHaveCount(3);
});

test('enforces skipped domains for live diagnostics while preserving manual screenshots', async ({
  context,
  extensionId,
  serviceWorker,
  extensionErrors,
}) => {
  const control = await context.newPage();
  await control.goto(`chrome-extension://${extensionId}/popup/index.html`);
  const page = await context.newPage();
  const url = 'http://127.0.0.1:4174/?skip-diagnostics';
  await page.goto(url);
  await expect(page.locator('#brie-root')).toHaveCount(1);
  const tabId = await serviceWorker.evaluate(async url => {
    const tabs = await chrome.tabs.query({});
    return tabs.find(tab => tab.url === url)!.id!;
  }, url);
  const readRecords = () =>
    control.evaluate(async id => {
      const response = await chrome.runtime.sendMessage({ type: 'GET_RECORDS', tabId: id });
      return response.records as { url?: string }[];
    }, tabId);
  await page.evaluate(() => fetch('/diagnostics-before-skip').then(response => response.text()));
  await expect
    .poll(async () => (await readRecords()).some(record => record.url?.includes('diagnostics-before-skip')))
    .toBe(true);
  await control.getByRole('button', { name: 'Settings', exact: true }).click();
  await control.getByLabel('Domain Skip List', { exact: true }).fill('127.0.0.1');
  await control.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(control.getByRole('list', { name: 'Skipped domains' })).toContainText('127.0.0.1');
  await page.evaluate(() => fetch('/diagnostics-after-skip').then(response => response.text()));
  await expect.poll(async () => (await readRecords()).length).toBe(0);
  await page.bringToFront();
  const capture = await control.evaluate(
    id => chrome.runtime.sendMessage({ type: 'START_SCREENSHOT_CAPTURE', tabId: id, captureType: 'viewport' }),
    tabId,
  );
  expect(capture).toEqual({ ok: true });
  await expect(page.getByTestId('screenshot-editor')).toBeVisible();
  expect(extensionErrors).toEqual([]);
});
