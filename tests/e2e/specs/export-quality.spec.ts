import { expect, test } from '../fixtures/extension.js';

for (const format of ['png', 'jpeg']) {
  test(`exports actual ${format.toUpperCase()} bytes with current annotations`, async ({
    context,
    serviceWorker,
    extensionErrors,
  }) => {
    const url = `http://127.0.0.1:4174/?export-${format}`;
    const page = await context.newPage();
    await page.goto(url);
    await expect(page.locator('#brie-root')).toHaveCount(1);
    await serviceWorker.evaluate(async selectedFormat => {
      await chrome.storage.local.set({
        'capture-settings-storage-key': {
          exportFormat: 'individual',
          screenshotFormat: selectedFormat,
          screenshotQuality: 75,
          includePerformance: false,
          retentionMinutes: 0,
          autoScreenshotOnError: false,
        },
      });
      const downloads = chrome.downloads as unknown as {
        download: (options: chrome.downloads.DownloadOptions) => Promise<number>;
      };
      downloads.download = async options => {
        (globalThis as typeof globalThis & { exportedImage?: chrome.downloads.DownloadOptions }).exportedImage =
          options;
        await new Promise(resolve => setTimeout(resolve, 800));
        return 9001;
      };
    }, format);
    await serviceWorker.evaluate(async target => {
      const tabs = await chrome.tabs.query({});
      const tab = tabs.find(item => item.url === target);
      await chrome.tabs.update(tab!.id!, { active: true });
      await chrome.tabs.sendMessage(tab!.id!, { action: 'START_SCREENSHOT', payload: { type: 'viewport' } });
    }, url);
    await expect(page.getByTestId('screenshot-editor')).toBeVisible();
    await expect
      .poll(async () =>
        serviceWorker.evaluate(async () => {
          const stored = await chrome.storage.local.get('annotations-storage-key');
          return Object.keys((stored['annotations-storage-key'] as Record<string, unknown>) ?? {}).length;
        }),
      )
      .toBeGreaterThan(0);
    await serviceWorker.evaluate(async () => {
      const key = 'annotations-storage-key';
      const stored = await chrome.storage.local.get(key);
      const annotations = stored[key] as Record<string, { objects?: unknown[] }>;
      const id = Object.keys(annotations)[0];
      annotations[id].objects = [
        {
          type: 'Rect',
          version: '6.7.1',
          left: 40,
          top: 40,
          width: 120,
          height: 70,
          fill: '#ef4444',
          stroke: '#ef4444',
          strokeWidth: 5,
          objectId: 'export-test',
          shapeType: 'rectangle',
        },
      ];
      await chrome.storage.local.set({ [key]: annotations });
    });
    await expect(page.getByRole('button', { name: 'Start over' })).toBeEnabled();
    await page.getByRole('button', { name: 'Minimize' }).click();
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await expect(page.getByTestId('screenshot-editor')).toBeVisible();
    await page.getByRole('button', { name: 'Download', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Download', exact: true })).toBeDisabled();
    await expect(page.getByTestId('screenshot-editor')).toHaveCount(0);
    const image = await serviceWorker.evaluate(
      () => (globalThis as typeof globalThis & { exportedImage?: chrome.downloads.DownloadOptions }).exportedImage,
    );
    expect(image?.filename).toMatch(new RegExp(`\\.${format}$`));
    expect(image?.url).toMatch(new RegExp(`^data:image/${format};base64,`));
    const redPixels = await page.evaluate(async src => {
      const image = new Image();
      image.src = src!;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d')!;
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let count = 0;
      for (let i = 0; i < pixels.length; i += 4)
        if (pixels[i] > 200 && pixels[i + 1] < 120 && pixels[i + 2] < 120) count += 1;
      return count;
    }, image?.url);
    expect(redPixels).toBeGreaterThan(100);
    expect(extensionErrors).toEqual([]);
  });
}
