import { readFile } from 'node:fs/promises';

import type { BrowserContext, Page } from '@playwright/test';

import { expect, test } from '../fixtures/extension.js';

const recordingPopup = async (context: BrowserContext, extensionId: string, tabId: number) => {
  const popup = await context.newPage();
  await popup.addInitScript(id => {
    const query = chrome.tabs.query.bind(chrome.tabs);
    chrome.tabs.query = (async details =>
      details.active ? [await chrome.tabs.get(id)] : query(details)) as typeof chrome.tabs.query;
  }, tabId);
  await popup.goto(`chrome-extension://${extensionId}/popup/index.html`);
  await popup.bringToFront();
  const recordTab = popup.getByRole('tab', { name: 'Record Tab', exact: true });
  await recordTab.focus();
  await recordTab.press('Enter');
  await expect(recordTab).toHaveAttribute('aria-selected', 'true');
  return popup;
};
const sourceTabId = (worker: Page, url: string) =>
  worker.evaluate(async url => (await chrome.tabs.query({})).find(tab => tab.url === url)!.id!, url);

test('records real WebM frames, pauses and resumes, exports original and trimmed playable video', async ({
  context,
  extensionId,
  extensionErrors,
}) => {
  const bridge = await context.newPage();
  await bridge.goto(`chrome-extension://${extensionId}/library/index.html`);
  const target = await context.newPage();
  const url = 'http://127.0.0.1:4174/?video-recording';
  await target.goto(url);
  await expect(target.locator('#brie-root')).toHaveCount(1);
  const tabId = await sourceTabId(bridge, url);
  // The native OS source picker cannot run unattended. Replace only its output
  // with a canvas MediaStream in the extension's isolated world; MediaRecorder,
  // recording controls, actual WebM encoding, playback and download stay real.
  await bridge.evaluate(async id => {
    await chrome.scripting.executeScript({
      target: { tabId: id },
      world: 'ISOLATED',
      func: () => {
        navigator.mediaDevices.getDisplayMedia = async () => {
          const canvas = document.createElement('canvas');
          canvas.width = 320;
          canvas.height = 180;
          const stream = canvas.captureStream(20);
          const context = canvas.getContext('2d')!;
          let frame = 0;
          const draw = () => {
            context.fillStyle = frame++ % 2 ? '#2563eb' : '#16a34a';
            context.fillRect(0, 0, 320, 180);
            context.fillStyle = '#fff';
            context.fillText(`Recorded frame ${frame}`, 30, 90);
            document.documentElement.setAttribute('data-recorded-frames', String(frame));
            if (stream.getVideoTracks().some(track => track.readyState === 'live')) requestAnimationFrame(draw);
          };
          draw();
          return stream;
        };
        window.addEventListener('VIDEO:CAPTURED', event => {
          const detail = (event as CustomEvent<{ blob: Blob; durationMs: number; segments: unknown[] }>).detail;
          document.documentElement.setAttribute(
            'data-recorded-result',
            JSON.stringify({ bytes: detail.blob.size, durationMs: detail.durationMs, segments: detail.segments }),
          );
        });
      },
    });
  }, tabId);
  const popup = await recordingPopup(context, extensionId, tabId);
  const microphone = popup.getByRole('switch', { name: 'Enable microphone', exact: true });
  if (await microphone.isChecked()) await microphone.press('Space');
  await expect(microphone).not.toBeChecked();
  await popup.getByRole('button', { name: 'Record Tab', exact: true }).click();
  await target.bringToFront();
  await target.getByRole('button', { name: 'Record this tab', exact: true }).click();
  await expect(target.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await expect
    .poll(async () => Number(await target.locator('html').getAttribute('data-recorded-frames')))
    .toBeGreaterThan(40);
  await target.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(target.getByRole('button', { name: 'Resume', exact: true })).toBeVisible();
  await bridge.bringToFront();
  await expect
    .poll(() =>
      bridge.evaluate(
        async () => (await chrome.storage.local.get('capture-state-storage-key'))['capture-state-storage-key'],
      ),
    )
    .toMatchObject({ mode: 'video', state: 'paused' });
  await target.bringToFront();
  await target.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(target.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  const resumedFrames = Number(await target.locator('html').getAttribute('data-recorded-frames'));
  await expect
    .poll(async () => Number(await target.locator('html').getAttribute('data-recorded-frames')))
    .toBeGreaterThan(resumedFrames + 40);
  await target.getByRole('button', { name: 'Stop & save', exact: true }).click();
  await expect(target.locator('video')).toBeVisible();
  await expect.poll(() => target.locator('video').evaluate(video => (video as HTMLVideoElement).videoWidth)).toBe(320);
  const result = JSON.parse((await target.locator('html').getAttribute('data-recorded-result'))!);
  expect(result.bytes).toBeGreaterThan(100);
  expect(result.durationMs).toBeGreaterThan(100);
  expect(result.segments).toHaveLength(2);
  const endHandle = target.getByRole('slider', { name: 'Trim end', exact: true });
  const originalEnd = Number(await endHandle.getAttribute('aria-valuenow'));
  await endHandle.focus();
  await endHandle.press('ArrowLeft');
  await expect.poll(async () => Number(await endHandle.getAttribute('aria-valuenow'))).toBeLessThan(originalEnd);
  await endHandle.press('End');
  await expect
    .poll(async () => Number(await endHandle.getAttribute('aria-valuenow')))
    .toBe(Number(await endHandle.getAttribute('aria-valuemax')));
  const [download] = await Promise.all([
    target.waitForEvent('download'),
    target.getByRole('button', { name: /Export.*webm/i }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.webm$/);
  const bytes = await readFile((await download.path())!);
  expect([...bytes.subarray(0, 4)]).toEqual([0x1a, 0x45, 0xdf, 0xa3]);
  expect(bytes.length).toBe(result.bytes);
  const timeline = await target.getByLabel('Playback timeline', { exact: true }).boundingBox();
  if (!timeline) throw new Error('The recording trim timeline is not visible.');
  await endHandle.hover();
  await target.mouse.down();
  await target.mouse.move(timeline.x + timeline.width / 2, timeline.y + timeline.height / 2, { steps: 8 });
  await target.mouse.up();
  await expect
    .poll(() => endHandle.evaluate(element => parseFloat((element as HTMLElement).style.left)))
    .toBeCloseTo(50, 0);
  // Encoder code, worker and WASM must come from the installed extension.
  await context.setOffline(true);
  const [trimmedDownload] = await Promise.all([
    target.waitForEvent('download'),
    target.getByRole('button', { name: /Export.*webm/i }).click(),
  ]);
  const trimmedBytes = await readFile((await trimmedDownload.path())!);
  expect([...trimmedBytes.subarray(0, 4)]).toEqual([0x1a, 0x45, 0xdf, 0xa3]);
  expect(trimmedBytes.equals(bytes)).toBe(false);
  const trimmedVideo = await target.evaluate(async encoded => {
    const data = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([data], { type: 'video/webm' }));
    const video = document.createElement('video');
    try {
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error('The trimmed export cannot be decoded.'));
        video.src = url;
      });
      return { duration: video.duration, width: video.videoWidth, height: video.videoHeight };
    } finally {
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(url);
    }
  }, trimmedBytes.toString('base64'));
  expect(trimmedVideo.width).toBe(320);
  expect(trimmedVideo.height).toBe(180);
  expect(trimmedVideo.duration).toBeGreaterThan(0.1);
  expect(Math.abs(trimmedVideo.duration - Number(await endHandle.getAttribute('aria-valuemax')) / 2)).toBeLessThan(0.2);
  await target.getByRole('button', { name: 'Close', exact: true }).first().click();
  await expect(target.locator('video')).toHaveCount(0);
  await bridge.bringToFront();
  await expect
    .poll(() =>
      bridge.evaluate(
        async () => (await chrome.storage.local.get('capture-state-storage-key'))['capture-state-storage-key'],
      ),
    )
    .toMatchObject({ mode: 'video', state: 'idle' });
  expect(
    extensionErrors.filter(
      error => !error.includes("Blocked script execution in 'about:blank' because the document's frame is sandboxed"),
    ),
  ).toEqual([]);
});

test('opts into Rewind, reviews captured page events, and stops capturing after disabling it', async ({
  context,
  extensionId,
  extensionErrors,
}) => {
  const bridge = await context.newPage();
  await bridge.goto(`chrome-extension://${extensionId}/library/index.html`);
  const target = await context.newPage();
  const url = 'http://127.0.0.1:4174/?rewind-recording';
  await target.goto(url);
  await expect(target.locator('#brie-root')).toHaveCount(1);
  const tabId = await sourceTabId(bridge, url);
  const popup = await recordingPopup(context, extensionId, tabId);
  const toggle = popup.getByRole('switch', { name: 'Toggle rewind', exact: true });
  await expect(toggle).not.toBeChecked();
  await toggle.press('Space');
  await expect(toggle).toBeChecked();
  await target.getByRole('button', { name: 'Test interaction', exact: true }).click();
  await target.evaluate(() => document.querySelector('h1')!.append(' — recorded interaction'));
  const storedEvents = () =>
    bridge.evaluate(async id => {
      const databases = await indexedDB.databases();
      if (!databases.some(database => database.name === 'brie_rewind_v1')) return [];
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('brie_rewind_v1', 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      return await new Promise<{ tabId: number; payload: unknown }[]>((resolve, reject) => {
        const request = database.transaction('events').objectStore('events').getAll();
        request.onsuccess = () => {
          database.close();
          resolve(request.result.filter((row: { tabId: number }) => row.tabId === id));
        };
        request.onerror = () => reject(request.error);
      });
    }, tabId);
  await expect.poll(async () => (await storedEvents()).length).toBeGreaterThan(2);
  await popup.getByRole('button', { name: 'Capture last minute before bug happened', exact: true }).click();
  await expect(target.getByRole('dialog')).toBeVisible();
  await expect(
    target.getByRole('heading', { name: 'Capture last minute before bug happened', exact: true }),
  ).toBeVisible();
  const control = await recordingPopup(context, extensionId, tabId);
  const frozen = await control.evaluate(
    id => chrome.runtime.sendMessage({ type: 'REWIND:GET_FROZEN', tabId: id }),
    tabId,
  );
  expect(frozen.events.some((event: { type: number }) => event.type === 2)).toBe(true);
  expect(frozen.events.some((event: { type: number }) => event.type === 4)).toBe(true);
  await control.getByRole('switch', { name: 'Toggle rewind', exact: true }).press('Space');
  await expect(control.getByRole('switch', { name: 'Toggle rewind', exact: true })).not.toBeChecked();
  // Clear previous events after disabling, then generate and flush new DOM activity.
  await control.evaluate(id => chrome.runtime.sendMessage({ type: 'REWIND:RESET_TAB', tabId: id }), tabId);
  await target.getByRole('button', { name: 'Close', exact: true }).first().click();
  await target.evaluate(() => document.querySelector('h1')!.append(' — must not be recorded'));
  await target.reload();
  await expect(target.locator('#brie-root')).toHaveCount(1);
  await target.getByRole('button', { name: 'Test interaction', exact: true }).click();
  const afterDisable = await control.evaluate(
    id => chrome.runtime.sendMessage({ type: 'REWIND:FREEZE', tabId: id }),
    tabId,
  );
  expect(afterDisable.events).toEqual([]);
  expect(
    extensionErrors.filter(
      error => !error.includes("Blocked script execution in 'about:blank' because the document's frame is sandboxed"),
    ),
  ).toEqual([]);
});
