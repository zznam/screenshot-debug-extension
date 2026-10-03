import { expect, test } from '../fixtures/extension.js';

test('saves system theme, JPEG quality, normalized skipped domains and reset options', async ({
  context,
  extensionId,
  serviceWorker,
  extensionErrors,
}) => {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup/index.html`);
  await popup.getByRole('button', { name: 'Settings', exact: true }).click();
  await popup.getByLabel('Theme', { exact: true }).selectOption('system');
  await popup.emulateMedia({ colorScheme: 'dark' });
  await expect(popup.locator('body')).toHaveClass(/dark/);
  await popup.emulateMedia({ colorScheme: 'light' });
  await expect(popup.locator('body')).toHaveClass(/light/);
  await popup.getByLabel('Theme', { exact: true }).selectOption('dark');
  await popup.emulateMedia({ colorScheme: 'light' });
  await expect(popup.locator('body')).toHaveClass(/dark/);
  await popup.getByLabel('Screenshot Format', { exact: true }).selectOption('jpeg');
  await popup.getByLabel('JPEG Quality:').focus();
  await popup.getByLabel('JPEG Quality:').press('Home');
  for (let step = 0; step < 5; step += 1) await popup.getByLabel('JPEG Quality:').press('ArrowRight');
  await expect
    .poll(async () =>
      serviceWorker.evaluate(async () => {
        const stored = await chrome.storage.local.get('capture-settings-storage-key');
        return (stored['capture-settings-storage-key'] as { screenshotQuality: number }).screenshotQuality;
      }),
    )
    .toBe(75);
  await popup.getByLabel('Domain Skip List', { exact: true }).fill(' HTTPS://Example.COM/private ');
  await popup.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(popup.getByRole('list', { name: 'Skipped domains' })).toContainText('example.com');
  await popup.getByLabel('Domain Skip List', { exact: true }).fill('bad domain');
  await popup.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(popup.getByRole('alert')).toContainText('Enter a domain');
  await popup.getByRole('button', { name: 'Reset capture settings' }).click();
  await expect(popup.getByLabel('Screenshot Format', { exact: true })).toHaveValue('png');
  await expect(popup.getByLabel('Theme', { exact: true })).toHaveValue('dark');
  await expect(popup.getByRole('list', { name: 'Skipped domains' })).toContainText('example.com');
  expect(extensionErrors).toEqual([]);
});
