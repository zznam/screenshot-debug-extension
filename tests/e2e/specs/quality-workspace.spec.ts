import { readFile } from 'node:fs/promises';

import type { Page, Route } from '@playwright/test';

import { expect, test } from '../fixtures/extension.js';
import { seedWorkspace } from '../fixtures/library-workspace.js';

const seedAi = async (page: Page, extensionId: string, connected = false) => {
  await page.route('http://127.0.0.1:43124/health', route => route.fulfill({ json: { keyConfigured: connected } }));
  await page.goto(`chrome-extension://${extensionId}/ai-debug/index.html`);
  await page.getByText('No AI sessions yet.').waitFor({ state: 'attached' });
  await page.evaluate(async () => {
    await chrome.storage.local.set({
      'ai-debug-helper-url': 'http://127.0.0.1:43124',
      'ai-debug-helper-pairing-token': 'fixture-token',
    });
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('screenshot_debug_ai_v1', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 160;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#f1f5f9';
    context.fillRect(0, 0, 320, 160);
    context.fillStyle = '#17212f';
    context.font = '22px system-ui';
    context.fillText('Checkout unavailable', 24, 80);
    const tx = database.transaction('sessions', 'readwrite');
    for (let index = 0; index < 2; index++)
      tx.objectStore('sessions').put({
        id: `session-${index}`,
        createdAt: 1,
        updatedAt: 2 + index,
        status: 'ready',
        model: 'fixture',
        messages: [
          {
            id: 'question',
            role: 'user',
            content: 'Investigate checkout for alice@example.com token=private-token',
            createdAt: 1,
          },
          {
            id: 'answer',
            role: 'assistant',
            content: 'The checkout request failed. Inspect its response and retry behavior. ' + 'x'.repeat(200),
            createdAt: 2,
          },
        ],
        context: {
          sourceId: 'source-private',
          sourceTabId: null,
          sourceTitle: index ? 'Account settings' : 'Checkout investigation',
          sourceUrl: 'https://example.com/?token=source-secret',
          capturedAt: 1,
          screenshotDataUrl: canvas.toDataURL(),
          records: [{ password: 'diagnostic-secret', message: 'alice@example.com' }],
          recordsTruncated: false,
        },
      });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    database.close();
  });
  await page.goto(`chrome-extension://${extensionId}/ai-debug/index.html?session=session-0`);
  await expect(page.getByRole('article', { name: 'AI response' })).toBeVisible();
};

test('keeps AI history, conversations and exports usable offline at narrow widths', async ({
  context,
  extensionId,
  extensionErrors,
}, testInfo) => {
  const page = await context.newPage();
  await seedAi(page, extensionId);
  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['light', 'dark']) {
      await page.evaluate(value => (document.documentElement.className = value), theme);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await expect(page.getByRole('article', { name: 'AI response' })).toBeVisible();
    }
    await page.screenshot({ path: testInfo.outputPath(`ai-workspace-${width}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 360, height: 900 });
  await page.getByRole('button', { name: 'Sessions', exact: true }).focus();
  await page.getByRole('button', { name: 'Sessions', exact: true }).press('Enter');
  await expect(page.getByRole('button', { name: 'Sessions', exact: true })).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('searchbox', { name: 'Find a session' }).fill('Account');
  await expect(page.getByRole('navigation', { name: 'Session history' }).getByRole('link')).toHaveCount(1);
  await page.getByRole('navigation', { name: 'Session history' }).getByRole('link').click();
  await expect(page.getByRole('heading', { name: 'Account settings', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeDisabled();
  expect(extensionErrors.filter(error => !error.includes('ERR_CONNECTION_REFUSED'))).toEqual([]);
});

test('exports only reviewed AI messages and opted-in redacted context', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await seedAi(page, extensionId);
  await page.getByRole('button', { name: 'Export session' }).click();
  await expect(page.getByRole('button', { name: 'Download JSON' })).toBeDisabled();
  await page.getByLabel(/Message 2 · AI assistant/).uncheck();
  await page.getByLabel('I have reviewed the selected conversation').check();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download JSON' }).click(),
  ]);
  const text = await readFile((await download.path())!, 'utf8');
  expect(JSON.parse(text).messages).toHaveLength(1);
  expect(JSON.parse(text)).not.toHaveProperty('context');
  expect(text).not.toMatch(
    /alice@example.com|private-token|source-secret|diagnostic-secret|screenshot|source-private|checkout request failed/,
  );
  await page.getByLabel('Include source URL and diagnostics').check();
  await expect(page.getByRole('button', { name: 'Download JSON' })).toBeDisabled();
  await page.getByLabel('I have reviewed the selected conversation').check();
  const [withContext] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download JSON' }).click(),
  ]);
  const contextText = await readFile((await withContext.path())!, 'utf8');
  expect(JSON.parse(contextText).context.records).toHaveLength(1);
  expect(contextText).not.toMatch(/alice@example.com|source-secret|diagnostic-secret|screenshotDataUrl|sourceTabId/);
});

test('retries failed AI questions once and stops in-flight analysis without losing the question', async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  let calls = 0;
  let held: Route | undefined;
  await page.route('http://127.0.0.1:43124/v1/debug/responses', async route => {
    calls++;
    if (calls === 1)
      await route.fulfill({
        json: { status: 'error', code: 'AI_REQUEST_FAILED', message: 'Temporary helper failure' },
      });
    else if (calls === 3) held = route;
    else
      await route.fulfill({
        json: {
          status: 'success',
          model: 'fixture',
          message: {
            id: `reply-${calls}`,
            role: 'assistant',
            content: `Recovered response ${calls}`,
            createdAt: Date.now(),
          },
        },
      });
  });
  await seedAi(page, extensionId, true);
  await page.getByLabel('Ask a follow-up', { exact: true }).fill('Investigate the network request');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Temporary helper failure');
  await page.getByRole('button', { name: 'Retry saved question' }).click();
  await expect(page.getByText('Recovered response 2', { exact: true })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Your message' })).toHaveCount(2);
  await page.getByLabel('Ask a follow-up', { exact: true }).fill('A cancellable question');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect.poll(() => Boolean(held)).toBe(true);
  await page.getByRole('button', { name: 'Stop analysis' }).click();
  await expect(page.getByText('Analysis stopped. Your saved question is ready to retry.')).toBeVisible();
  await held!.abort().catch(() => undefined);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Retry saved question' })).toBeVisible();
  expect(calls).toBe(3);
  await page.getByRole('button', { name: 'Retry saved question' }).click();
  await expect(page.getByText('Recovered response 4', { exact: true })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Your message' })).toHaveCount(3);
});

test('recovers invalid pairing and keeps a session when deletion fails', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.route('http://127.0.0.1:43124/v1/debug/responses', route =>
    route.fulfill({ json: { status: 'error', code: 'PAIRING_REQUIRED', message: 'The pairing token is invalid.' } }),
  );
  await seedAi(page, extensionId, true);
  await page.getByLabel('Ask a follow-up', { exact: true }).fill('Try this question');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('The pairing token is invalid.');
  await expect(page.getByLabel('Pairing token', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Clear session', exact: true }).click();
  await page.getByRole('button', { name: 'Keep session' }).click();
  await expect(page.getByRole('button', { name: 'Delete permanently' })).toHaveCount(0);
  await page.evaluate(() => {
    const send = chrome.runtime.sendMessage.bind(chrome.runtime);
    chrome.runtime.sendMessage = ((message: { type: string }) =>
      message.type === 'AI_DEBUG:DELETE_SESSION'
        ? Promise.resolve({ status: 'error', message: 'Storage unavailable' })
        : send(message)) as typeof chrome.runtime.sendMessage;
  });
  await page.getByRole('button', { name: 'Clear session', exact: true }).click();
  await page.getByRole('button', { name: 'Delete permanently' }).click();
  await expect(page.getByRole('alert')).toHaveText('Storage unavailable');
  await expect(page.getByRole('article', { name: 'Your message' })).toHaveCount(2);
});

test('sorts and paginates captures while preserving discovery when returning from details', async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await seedWorkspace(page, extensionId);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(resolve => {
      const request = indexedDB.open('screenshot_debug_library_v1', 1);
      request.onsuccess = () => resolve(request.result);
    });
    const tx = db.transaction('captures', 'readwrite');
    const store = tx.objectStore('captures');
    const request = store.get('capture-0');
    request.onsuccess = () => {
      for (let i = 3; i < 31; i++)
        store.put({
          ...request.result,
          id: `capture-${i}`,
          title: `Checkout ${String(i).padStart(2, '0')}`,
          createdAt: 1000 + i,
        });
    };
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  await expect(page.locator('.library-card')).toHaveCount(24);
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.locator('.library-card')).toHaveCount(7);
  await expect(page).toHaveURL(/page=2/);
  await page.reload();
  await expect(page.locator('.library-card')).toHaveCount(7);
  await page.getByLabel('Sort captures', { exact: true }).selectOption('title');
  await page.getByRole('searchbox', { name: 'Search', exact: true }).fill('Checkout');
  await page.getByRole('button', { name: 'Next page' }).click();
  await page.locator('.library-card').first().click();
  await page.getByRole('link', { name: 'All captures' }).click();
  await expect(page.getByRole('searchbox', { name: 'Search', exact: true })).toHaveValue('Checkout');
  await expect(page.getByLabel('Sort captures', { exact: true })).toHaveValue('title');
  await expect(page).toHaveURL(/page=2/);
});

test('protects unsaved capture details and report drafts, then allows navigation after saving', async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await seedWorkspace(page, extensionId);
  await page.goto(`chrome-extension://${extensionId}/library/index.html?capture=capture-0`);
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('A carefully named capture');
  const cancelLeave = page.waitForEvent('dialog').then(async dialog => {
    expect(dialog.type()).toBe('beforeunload');
    await dialog.dismiss();
  });
  await page.getByRole('link', { name: 'All captures' }).click();
  await cancelLeave;
  await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue('A carefully named capture');
  await page.getByRole('button', { name: 'Save details' }).click();
  await expect(page.getByText('Changes saved.', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'All captures' }).click();
  await expect(page.locator('.library-card')).toHaveCount(3);
  await page.goto(`chrome-extension://${extensionId}/library/index.html?capture=capture-0&share=1`);
  await page.getByLabel('Steps to reproduce', { exact: true }).fill('Do not lose these steps');
  const keepDraft = page.waitForEvent('dialog').then(async dialog => {
    expect(dialog.type()).toBe('beforeunload');
    await dialog.dismiss();
  });
  await page.getByRole('link', { name: 'Back to capture' }).click();
  await keepDraft;
  await expect(page.getByLabel('Steps to reproduce', { exact: true })).toHaveValue('Do not lose these steps');
});

test('rejects an oversized full-page capture and leaves viewport capture usable', async ({ context, extensionId }) => {
  const control = await context.newPage();
  await control.goto(`chrome-extension://${extensionId}/popup/index.html`);
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4174/?large-capture');
  await expect(page.locator('#brie-root')).toHaveCount(1);
  await page.evaluate(() => {
    document.body.style.height = '100000px';
  });
  const result = await control.evaluate(async () => {
    const tab = (await chrome.tabs.query({})).find(item => item.url?.includes('?large-capture'))!;
    return chrome.runtime.sendMessage({ type: 'START_SCREENSHOT_CAPTURE', tabId: tab.id, captureType: 'full-page' });
  });
  expect(result).toMatchObject({ ok: false, error: expect.stringContaining('too large') });
  await page.bringToFront();
  const retry = await control.evaluate(async () => {
    const tab = (await chrome.tabs.query({})).find(item => item.url?.includes('?large-capture'))!;
    return chrome.runtime.sendMessage({ type: 'START_SCREENSHOT_CAPTURE', tabId: tab.id, captureType: 'viewport' });
  });
  expect(retry).toMatchObject({ ok: true });
  await expect(page.getByTestId('screenshot-editor')).toBeVisible();
});

test('renders a normal full-page capture into the editable screenshot workflow', async ({
  context,
  extensionId,
  extensionErrors,
}) => {
  const control = await context.newPage();
  await control.goto(`chrome-extension://${extensionId}/popup/index.html`);
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4174/?full-page-quality');
  await expect(page.locator('#brie-root')).toHaveCount(1);
  const result = await control.evaluate(async () => {
    const tab = (await chrome.tabs.query({})).find(item => item.url?.includes('?full-page-quality'))!;
    return chrome.runtime.sendMessage({ type: 'START_SCREENSHOT_CAPTURE', tabId: tab.id, captureType: 'full-page' });
  });
  expect(result).toMatchObject({ ok: true });
  await expect(page.getByTestId('screenshot-editor')).toBeVisible();
  await expect(page.locator('#brie-canvas')).toBeVisible();
  expect(extensionErrors).toEqual([]);
});
