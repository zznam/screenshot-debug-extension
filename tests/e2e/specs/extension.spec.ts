import type { Worker } from '@playwright/test';
import { unzipSync } from 'fflate';

import { expect, test } from '../fixtures/extension.js';

const targetUrl = 'http://127.0.0.1:4174/';
const captureStateKey = 'capture-state-storage-key';
const captureTabKey = 'capture-tab-storage-key';
const themeKey = 'theme-storage-key';
const debugModeKey = 'debug-mode-storage-key';
const captureSettingsKey = 'capture-settings-storage-key';

const rgbChannels = (color: string) =>
  color
    .match(/[\d.]+/g)
    ?.slice(0, 3)
    .map(Number) ?? [];

const contrastRatio = (foreground: string, background: string) => {
  const luminance = (color: string) => {
    const channels = rgbChannels(color).map(channel => {
      const normalized = channel / 255;
      return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };

  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
};

const getTabId = async (serviceWorker: Worker, url: string) =>
  serviceWorker.evaluate(async target => {
    const tabs = await chrome.tabs.query({});
    return tabs.find(tab => tab.url === target)?.id ?? null;
  }, url);

const setScreenshotSession = async (
  serviceWorker: Worker,
  tabId: number | null,
  state: 'capturing' | 'unsaved' = 'capturing',
) =>
  serviceWorker.evaluate(
    async session => {
      await chrome.storage.local.set({
        [session.captureStateKey]: { mode: 'screenshot', state: session.state },
        [session.captureTabKey]: session.tabId,
      });
    },
    { captureStateKey, captureTabKey, state, tabId },
  );

const startViewportCapture = async (serviceWorker: Worker, url: string) =>
  serviceWorker.evaluate(async target => {
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find(candidate => candidate.url === target);
    if (!tab?.id) throw new Error('Capture target tab was not found.');

    return chrome.tabs.sendMessage(tab.id, {
      action: 'START_SCREENSHOT',
      payload: { type: 'viewport' },
    });
  }, url);

const resetDownloadObserver = async (serviceWorker: Worker) =>
  serviceWorker.evaluate(() => {
    type TestGlobal = typeof globalThis & { __testDownloadOptions?: chrome.downloads.DownloadOptions[] };
    const testGlobal = globalThis as TestGlobal;
    testGlobal.__testDownloadOptions = [];
    const downloads = chrome.downloads as unknown as {
      download: (options: chrome.downloads.DownloadOptions) => Promise<number>;
    };
    downloads.download = async options => {
      testGlobal.__testDownloadOptions!.push(options);
      return 9_000 + testGlobal.__testDownloadOptions!.length;
    };
  });

const getObservedDownloads = async (serviceWorker: Worker) =>
  serviceWorker.evaluate(() => {
    const testGlobal = globalThis as typeof globalThis & {
      __testDownloadOptions?: chrome.downloads.DownloadOptions[];
    };
    return (testGlobal.__testDownloadOptions ?? []).map(options => ({
      filename: options.filename,
      url: options.url,
    }));
  });

test('starts the service worker and injects the page runtime idempotently', async ({
  context,
  extensionErrors,
  serviceWorker,
}) => {
  expect(serviceWorker.url()).toContain('chrome-extension://');

  const target = await context.newPage();
  await target.goto(targetUrl);

  await expect(target.locator('html')).toHaveAttribute('data-brie-extend', 'true');
  await expect(target.locator('#brie-root')).toHaveCount(1);
  await expect(target.locator('#brie-root')).toHaveAttribute('data-screenshot-debug-version', '0.5.27');

  const tabId = await serviceWorker.evaluate(async url => {
    const tabs = await chrome.tabs.query({});
    return tabs.find(tab => tab.url === url)?.id;
  }, targetUrl);
  expect(tabId).toBeTruthy();

  await serviceWorker.evaluate(async id => {
    await chrome.scripting.executeScript({ target: { tabId: id! }, files: ['content-ui/index.iife.js'] });
  }, tabId);

  await expect(target.locator('#brie-root')).toHaveCount(1);
  expect(extensionErrors).toEqual([]);
});

test('renders the popup and a friendly restricted-page error', async ({ context, extensionErrors, extensionId }) => {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup/index.html`);

  await expect(popup.getByRole('heading', { name: 'Screenshot & Debug' })).toBeVisible();
  await expect(popup.getByTitle('View the source code on GitHub')).toBeVisible();
  await expect(popup.getByRole('tab', { name: 'Screenshots' })).toBeVisible();
  await expect(popup.getByRole('tab', { name: 'Record' })).toBeVisible();

  await popup.locator('#viewport').click({ force: true });
  await expect(popup.getByText(/Open a regular HTTP or HTTPS website/)).toBeVisible();
  expect(extensionErrors.filter(error => !error.includes('Open a regular HTTP'))).toEqual([]);
});

test('opens a persistent AI Debug session with screenshot and diagnostics', async ({
  context,
  extensionErrors,
  extensionId,
  serviceWorker,
}) => {
  const aiTargetUrl = `${targetUrl}?ai-debug`;
  const target = await context.newPage();
  await target.goto(aiTargetUrl);
  await expect(target.locator('#brie-root')).toHaveCount(1);
  await target.evaluate(async () => {
    console.error('deterministic-ai-debug-error');
    await fetch('/api/fail');
  });
  await target.bringToFront();

  await serviceWorker.evaluate(
    async ({ tokenKey, token }) => {
      await chrome.storage.local.set({ [tokenKey]: token });
    },
    { tokenKey: 'ai-debug-helper-pairing-token', token: 'e2e-pair-token' },
  );

  const tabId = await getTabId(serviceWorker, aiTargetUrl);
  expect(tabId).toBeTruthy();
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup/index.html`);
  await target.bringToFront();
  const aiPagePromise = context.waitForEvent('page', page => page.url().includes('/ai-debug/index.html'));
  await popup.getByRole('button', { name: 'AI Debug' }).evaluate(button => (button as HTMLElement).click());
  const aiPage = await aiPagePromise;
  await aiPage.waitForLoadState();

  await expect(aiPage.getByRole('heading', { name: 'Screenshot & Debug Test Page' })).toBeVisible();
  await aiPage.getByText(/Debug context · \d+ records/).click();
  await expect(aiPage.getByAltText('Captured source page')).toBeVisible();
  await expect(aiPage.getByText(/Mock diagnosis for Screenshot & Debug Test Page/)).toBeVisible();

  await aiPage.reload();
  await expect(aiPage.getByText(/Mock diagnosis for Screenshot & Debug Test Page/)).toBeVisible();
  await expect(aiPage.getByText('Helper connected')).toBeVisible();
  expect(aiPage.url()).toContain(`chrome-extension://${extensionId}/ai-debug/index.html?session=`);
  expect(extensionErrors.filter(error => !error.includes('deterministic-ai-debug-error'))).toEqual([]);
});

test('captures the viewport and opens the screenshot editor', async ({ context, extensionErrors, serviceWorker }) => {
  const target = await context.newPage();
  await target.goto(targetUrl);
  await target.bringToFront();
  await expect(target.locator('#brie-root')).toHaveCount(1);

  const response = await serviceWorker.evaluate(async url => {
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find(candidate => candidate.url === url);
    if (!tab?.id) throw new Error('Capture target tab was not found.');

    return await chrome.tabs.sendMessage(tab.id, {
      action: 'START_SCREENSHOT',
      payload: { type: 'viewport' },
    });
  }, targetUrl);

  expect(response).toEqual({ ok: true });
  await expect(target.locator('#brie-canvas')).toBeVisible();
  expect(extensionErrors).toEqual([]);
});

test('downloads debug JSON in individual and ZIP exports before clearing records', async ({
  context,
  extensionErrors,
  serviceWorker,
}) => {
  const downloadTargetUrl = `${targetUrl}?debug-download`;
  const target = await context.newPage();
  await target.goto(downloadTargetUrl);
  await expect(target.locator('#brie-root')).toHaveCount(1);

  const tabId = await getTabId(serviceWorker, downloadTargetUrl);
  expect(tabId).toBeTruthy();
  await serviceWorker.evaluate(
    async ({ debugKey, settingsKey }) => {
      await chrome.downloads.erase({});
      await chrome.storage.local.set({
        [debugKey]: true,
        [settingsKey]: {
          exportFormat: 'individual',
          screenshotFormat: 'png',
          screenshotQuality: 100,
          includePerformance: false,
          retentionMinutes: 0,
          autoScreenshotOnError: false,
        },
      });
    },
    { debugKey: debugModeKey, settingsKey: captureSettingsKey },
  );
  await resetDownloadObserver(serviceWorker);

  await target.evaluate(() => fetch('/debug-data?individual').then(response => response.text()));
  await expect
    .poll(async () => {
      return serviceWorker.evaluate(async id => {
        const request = indexedDB.open('screenshot_debug_records_v1', 1);
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        const transaction = db.transaction('records', 'readonly');
        const records = transaction.objectStore('records').index('tabId').getAll(id!);
        return new Promise<number>((resolve, reject) => {
          records.onsuccess = () => resolve(records.result.length);
          records.onerror = () => reject(records.error);
        });
      }, tabId);
    })
    .toBeGreaterThan(0);
  const exportedRecordIds = await serviceWorker.evaluate(async id => {
    const request = indexedDB.open('screenshot_debug_records_v1', 1);
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = db.transaction('records', 'readonly');
    const records = transaction.objectStore('records').index('tabId').getAll(id!);
    return new Promise<string[]>((resolve, reject) => {
      records.onsuccess = () => resolve(records.result.map(record => record.uuid));
      records.onerror = () => reject(records.error);
    });
  }, tabId);

  expect(await startViewportCapture(serviceWorker, downloadTargetUrl)).toEqual({ ok: true });
  await target.getByRole('button', { name: 'Download' }).click();
  await expect(target.getByTestId('screenshot-editor')).toHaveCount(0);

  await expect.poll(async () => (await getObservedDownloads(serviceWorker)).length).toBe(2);
  const individualDownloads = await getObservedDownloads(serviceWorker);
  const jsonDownload = individualDownloads.find(download => download.filename?.endsWith('.json'));
  expect(jsonDownload).toBeTruthy();
  const report = JSON.parse(atob(jsonDownload!.url.split(',')[1]));
  expect(report.network.requests.length + report.console.errors.length + report.events.length).toBeGreaterThan(0);

  await expect
    .poll(async () => {
      return serviceWorker
        .evaluate(async id => {
          const request = indexedDB.open('screenshot_debug_records_v1', 1);
          const db = await new Promise<IDBDatabase>((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          const transaction = db.transaction('records', 'readonly');
          const records = transaction.objectStore('records').index('tabId').getAll(id!);
          return new Promise<string[]>((resolve, reject) => {
            records.onsuccess = () => resolve(records.result.map(record => record.uuid));
            records.onerror = () => reject(records.error);
          });
        }, tabId)
        .then(ids => ids.filter(id => exportedRecordIds.includes(id)).length);
    })
    .toBe(0);

  await serviceWorker.evaluate(async settingsKey => {
    const stored = await chrome.storage.local.get(settingsKey);
    await chrome.storage.local.set({ [settingsKey]: { ...stored[settingsKey], exportFormat: 'zip' } });
    await chrome.downloads.erase({});
  }, captureSettingsKey);
  await resetDownloadObserver(serviceWorker);
  await target.evaluate(() => fetch('/debug-data?zip').then(response => response.text()));
  expect(await startViewportCapture(serviceWorker, downloadTargetUrl)).toEqual({ ok: true });

  await target.getByRole('button', { name: 'Download' }).click();
  await expect.poll(async () => (await getObservedDownloads(serviceWorker)).length).toBe(1);
  const [zipDownload] = await getObservedDownloads(serviceWorker);
  const entries = unzipSync(Uint8Array.from(atob(zipDownload.url.split(',')[1]), value => value.charCodeAt(0)));
  expect(Object.keys(entries).some(filename => filename.endsWith('.png'))).toBe(true);
  expect(Object.keys(entries).some(filename => filename.endsWith('.json'))).toBe(true);
  expect(entries['network.har']).toBeTruthy();
  expect(extensionErrors).toEqual([]);
});

test('renders readable dark editor chrome and updates live to light mode', async ({
  context,
  extensionErrors,
  serviceWorker,
}) => {
  const darkTargetUrl = `${targetUrl}?dark-editor`;
  const target = await context.newPage();
  await target.goto(darkTargetUrl);
  await expect(target.locator('#brie-root')).toHaveCount(1);

  await serviceWorker.evaluate(async key => chrome.storage.local.set({ [key]: 'dark' }), themeKey);
  await expect(target.locator('#brie-content')).toHaveClass(/dark/);

  const response = await serviceWorker.evaluate(async url => {
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find(candidate => candidate.url === url);
    if (!tab?.id) throw new Error('Dark-mode capture target tab was not found.');

    return chrome.tabs.sendMessage(tab.id, {
      action: 'START_SCREENSHOT',
      payload: { type: 'viewport' },
    });
  }, darkTargetUrl);
  expect(response).toEqual({ ok: true });

  const editor = target.getByTestId('screenshot-editor');
  const header = target.getByTestId('editor-header');
  const toolbar = target.getByTestId('editor-toolbar');
  const footer = target.getByTestId('editor-footer');
  const sidebar = target.getByTestId('editor-left-sidebar');
  await expect(editor).toBeVisible();
  await expect(toolbar).toBeVisible();

  const darkStyles = await Promise.all(
    [editor, header, toolbar, footer, sidebar].map(locator =>
      locator.evaluate(element => {
        const style = getComputedStyle(element);
        return { backgroundColor: style.backgroundColor, color: style.color };
      }),
    ),
  );
  darkStyles.forEach(style => {
    expect(style.backgroundColor).not.toBe('rgb(255, 255, 255)');
    expect(contrastRatio(style.color, style.backgroundColor)).toBeGreaterThanOrEqual(4.5);
  });

  const editorBackground = await editor.evaluate(element => getComputedStyle(element).backgroundImage);
  expect(editorBackground).toContain('annotation-bg-dark.png');

  const title = target.getByRole('button', { name: 'Untitled report' });
  const titleStyle = await title.evaluate(element => {
    const style = getComputedStyle(element);
    return { color: style.color, backgroundColor: getComputedStyle(element.closest('header')!).backgroundColor };
  });
  expect(contrastRatio(titleStyle.color, titleStyle.backgroundColor)).toBeGreaterThanOrEqual(4.5);

  const download = target.getByRole('button', { name: 'Download' });
  expect(await download.evaluate(element => getComputedStyle(element).color)).toBe('rgb(255, 255, 255)');

  const canvasAppearance = await target.locator('#brie-canvas').evaluate(element => {
    const style = getComputedStyle(element);
    const canvas = element as HTMLCanvasElement;
    const context = canvas.getContext('2d');
    const sample = context?.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data;
    return {
      filter: style.filter,
      mixBlendMode: style.mixBlendMode,
      opacity: style.opacity,
      sample: sample ? Array.from(sample) : [],
    };
  });
  expect(canvasAppearance).toMatchObject({ filter: 'none', mixBlendMode: 'normal', opacity: '1' });
  expect(Math.max(...canvasAppearance.sample.slice(0, 3))).toBeGreaterThan(200);

  await serviceWorker.evaluate(async key => chrome.storage.local.set({ [key]: 'light' }), themeKey);
  await expect(target.locator('#brie-content')).toHaveClass(/light/);
  await expect
    .poll(() => editor.evaluate(element => getComputedStyle(element).backgroundColor))
    .toBe('rgb(255, 255, 255)');
  expect(await editor.evaluate(element => getComputedStyle(element).backgroundImage)).toContain(
    'annotation-bg-light.png',
  );
  expect(extensionErrors).toEqual([]);
});

test('exits screenshot capture from another tab and cleans the owner page', async ({
  context,
  extensionErrors,
  extensionId,
  serviceWorker,
}) => {
  const ownerUrl = `${targetUrl}?capture-owner`;
  const owner = await context.newPage();
  await owner.goto(ownerUrl);
  await expect(owner.locator('#brie-root')).toHaveCount(1);

  const ownerTabId = await getTabId(serviceWorker, ownerUrl);
  expect(ownerTabId).toBeTruthy();
  await setScreenshotSession(serviceWorker, ownerTabId);
  await serviceWorker.evaluate(async tabId => {
    await chrome.tabs.sendMessage(tabId!, {
      action: 'START_SCREENSHOT',
      payload: { type: 'area' },
    });
  }, ownerTabId);
  await expect(owner.locator('#screenshot-overlay')).toBeVisible();

  const other = await context.newPage();
  await other.goto(`${targetUrl}?other-tab`);
  await other.bringToFront();

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup/index.html`);
  const exitButton = popup.getByRole('button', { name: 'Exit Capture Screenshot' });
  await expect(exitButton).toBeVisible();
  await exitButton.click();

  await expect(owner.locator('#screenshot-overlay')).toHaveCount(0);
  await expect(popup.locator('#viewport')).toBeVisible();
  const session = await serviceWorker.evaluate(
    async keys => chrome.storage.local.get(keys),
    [captureStateKey, captureTabKey],
  );
  expect(session[captureStateKey]).toEqual({ mode: 'screenshot', state: 'idle' });
  expect(session[captureTabKey]).toBeNull();
  expect(extensionErrors).toEqual([]);
});

test('reconciles screenshot capture with a missing or closed owner', async ({
  context,
  extensionErrors,
  extensionId,
  serviceWorker,
}) => {
  await setScreenshotSession(serviceWorker, null);

  const orphanPopup = await context.newPage();
  await orphanPopup.goto(`chrome-extension://${extensionId}/popup/index.html`);
  await expect(orphanPopup.locator('#viewport')).toBeVisible();

  const closedOwner = await context.newPage();
  const closedOwnerUrl = `${targetUrl}?closed-owner`;
  await closedOwner.goto(closedOwnerUrl);
  const closedOwnerId = await getTabId(serviceWorker, closedOwnerUrl);
  expect(closedOwnerId).toBeTruthy();
  await closedOwner.close();
  await setScreenshotSession(serviceWorker, closedOwnerId);

  const stalePopup = await context.newPage();
  await stalePopup.goto(`chrome-extension://${extensionId}/popup/index.html`);
  await expect(stalePopup.locator('#viewport')).toBeVisible();

  const session = await serviceWorker.evaluate(
    async keys => chrome.storage.local.get(keys),
    [captureStateKey, captureTabKey],
  );
  expect(session[captureStateKey]).toEqual({ mode: 'screenshot', state: 'idle' });
  expect(session[captureTabKey]).toBeNull();
  expect(extensionErrors).toEqual([]);
});

test('returns to the capture owner from another tab', async ({ context, extensionId, serviceWorker }) => {
  const ownerUrl = `${targetUrl}?go-to-owner`;
  const owner = await context.newPage();
  await owner.goto(ownerUrl);
  const ownerTabId = await getTabId(serviceWorker, ownerUrl);
  expect(ownerTabId).toBeTruthy();
  await setScreenshotSession(serviceWorker, ownerTabId);

  const other = await context.newPage();
  await other.goto(`${targetUrl}?go-to-other`);
  await other.bringToFront();

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup/index.html`);
  const goToOwner = popup.getByRole('button', { name: 'Go to active tab' });
  await expect(goToOwner).toBeVisible();
  await goToOwner.click();

  const activeTabId = await serviceWorker.evaluate(async () => {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return activeTab?.id ?? null;
  });
  expect(activeTabId).toBe(ownerTabId);
});
