import { readFile } from 'node:fs/promises';

import { expect, test } from '../fixtures/extension.js';
import { seedWorkspace } from '../fixtures/library-workspace.js';

test('persists favorite, workflow status and investigation notes and finds them through combined filters', async ({
  context,
  extensionId,
  extensionErrors,
}) => {
  const page = await context.newPage();
  await seedWorkspace(page, extensionId);
  await page.goto(`chrome-extension://${extensionId}/library/index.html?capture=capture-0`);
  await page.getByLabel('Favorite capture', { exact: true }).check();
  await page.getByRole('combobox', { name: 'Workflow status', exact: true }).selectOption('in-progress');
  await page.getByLabel('Investigation notes', { exact: true }).fill('Investigating checkout retry with release QA');
  await page.getByRole('textbox', { name: 'Tags', exact: false }).fill('checkout, release');
  await page.getByRole('button', { name: 'Save details', exact: true }).click();
  await expect(page.getByText('Changes saved.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Favorite capture', { exact: true })).toBeChecked();
  await expect(page.getByRole('combobox', { name: 'Workflow status', exact: true })).toHaveValue('in-progress');
  await expect(page.getByLabel('Investigation notes', { exact: true })).toHaveValue(
    'Investigating checkout retry with release QA',
  );
  await page.getByRole('link', { name: 'All captures', exact: false }).click();
  await page.getByRole('combobox', { name: 'Favorites', exact: true }).selectOption('only');
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('in-progress');
  await page.getByRole('combobox', { name: 'Tag', exact: true }).selectOption('release');
  await page.getByRole('searchbox', { name: 'Search', exact: true }).fill('release QA');
  await expect(page.locator('.library-card')).toHaveCount(1);
  await expect(page.locator('.library-card')).toContainText('Checkout before');
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Favorites', exact: true })).toHaveValue('only');
  await expect(page.getByRole('combobox', { name: 'Status', exact: true })).toHaveValue('in-progress');
  await expect(page.getByRole('combobox', { name: 'Tag', exact: true })).toHaveValue('release');
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('resolved');
  await expect(page.locator('.library-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(page.locator('.library-card')).toHaveCount(3);
  // Older captures retain useful defaults without a data migration.
  await page.goto(`chrome-extension://${extensionId}/library/index.html?capture=capture-1`);
  await expect(page.getByLabel('Favorite capture', { exact: true })).not.toBeChecked();
  await expect(page.getByRole('combobox', { name: 'Workflow status', exact: true })).toHaveValue('open');
  await expect(page.getByLabel('Investigation notes', { exact: true })).toHaveValue('');
  expect(extensionErrors).toEqual([]);
});

test('saves, replaces, restores and deletes named library views without changing captures', async ({
  context,
  extensionId,
  extensionErrors,
}) => {
  const page = await context.newPage();
  await seedWorkspace(page, extensionId);
  const search = page.getByRole('searchbox', { name: 'Search', exact: true });
  await search.fill('before');
  await page.getByRole('combobox', { name: 'Sort captures', exact: true }).selectOption('title');
  await page.getByRole('combobox', { name: 'Tag', exact: true }).selectOption('checkout');
  await page.getByLabel('Saved view name', { exact: true }).fill('Checkout investigation');
  await page.getByRole('button', { name: 'Save current view', exact: true }).click();
  await expect(page.getByText('View saved on this device.', { exact: true })).toBeVisible();
  await search.fill('after');
  await page.getByLabel('Saved view name', { exact: true }).fill('Checkout investigation');
  await page.getByRole('button', { name: 'Save current view', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Saved views', exact: true }).locator('option')).toHaveCount(2);
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await page.reload();
  await page
    .getByRole('combobox', { name: 'Saved views', exact: true })
    .selectOption({ label: 'Checkout investigation' });
  await page.getByRole('button', { name: 'Apply saved view', exact: true }).click();
  await expect(search).toHaveValue('after');
  await expect(page.getByRole('combobox', { name: 'Sort captures', exact: true })).toHaveValue('title');
  await expect(page.getByRole('combobox', { name: 'Tag', exact: true })).toHaveValue('checkout');
  await expect(page.locator('.library-card')).toHaveCount(1);
  await expect(page.locator('.library-card')).toContainText('Checkout after');
  await page.getByRole('button', { name: 'Delete saved view', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Saved views', exact: true }).locator('option')).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Saved views', exact: true }).locator('option')).toHaveCount(1);
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(page.locator('.library-card')).toHaveCount(3);
  expect(extensionErrors).toEqual([]);
});

test('navigates captures with keyboard shortcuts without intercepting typing or modifier keys', async ({
  context,
  extensionId,
  extensionErrors,
}) => {
  const page = await context.newPage();
  await seedWorkspace(page, extensionId);
  await page.locator('body').click({ position: { x: 4, y: 4 } });
  await page.keyboard.press('j');
  await expect(page.locator('.library-card').nth(0)).toBeFocused();
  await page.keyboard.press('j');
  await expect(page.locator('.library-card').nth(1)).toBeFocused();
  await page.keyboard.press('k');
  await expect(page.locator('.library-card').nth(0)).toBeFocused();
  await page.keyboard.press('?');
  await expect(page.getByRole('region', { name: 'Library keyboard shortcuts', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('region', { name: 'Library keyboard shortcuts', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Keyboard shortcuts', exact: true })).toBeFocused();
  await page.keyboard.press('/');
  const search = page.getByRole('searchbox', { name: 'Search', exact: true });
  await expect(search).toBeFocused();
  await search.pressSequentially('j/k?');
  await expect(search).toHaveValue('j/k?');
  await expect(search).toBeFocused();
  await expect(page.getByRole('region', { name: 'Library keyboard shortcuts', exact: true })).toHaveCount(0);
  await search.fill('');
  await page.getByRole('button', { name: 'Keyboard shortcuts', exact: true }).focus();
  await page.keyboard.press('Control+j');
  await expect(page.getByRole('button', { name: 'Keyboard shortcuts', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Keyboard shortcuts', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Enable single-key shortcuts', exact: true }).uncheck();
  await page.reload();
  await page.locator('body').click({ position: { x: 4, y: 4 } });
  await page.keyboard.press('?');
  await expect(page.getByRole('region', { name: 'Library keyboard shortcuts', exact: true })).toHaveCount(0);
  await page.keyboard.press('/');
  await expect(search).not.toBeFocused();
  await page.keyboard.press('j');
  await expect(page.locator('.library-card').first()).not.toBeFocused();
  await page.getByRole('button', { name: 'Keyboard shortcuts', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Enable single-key shortcuts', exact: true })).not.toBeChecked();
  await page.getByRole('checkbox', { name: 'Enable single-key shortcuts', exact: true }).check();
  await page.getByRole('button', { name: 'Keyboard shortcuts', exact: true }).focus();
  await page.keyboard.press('Escape');
  await page.keyboard.press('j');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toBeVisible();
  expect(extensionErrors).toEqual([]);
});

test('applies report templates with explicit replacement and preserves severity and environment', async ({
  context,
  extensionId,
  extensionErrors,
}) => {
  const page = await context.newPage();
  await seedWorkspace(page, extensionId);
  await page.goto(`chrome-extension://${extensionId}/library/index.html?capture=capture-0&share=1`);
  await page.getByRole('combobox', { name: 'Severity', exact: true }).selectOption('high');
  await page.getByLabel('Environment', { exact: true }).fill('Chrome on macOS, staging');
  await page.getByRole('combobox', { name: 'Report template', exact: true }).selectOption('regression');
  await page.getByRole('button', { name: 'Apply template', exact: true }).click();
  await expect(page.getByLabel('Steps to reproduce', { exact: true })).toHaveValue(/last working version/);
  await page.getByLabel('Steps to reproduce', { exact: true }).fill('My careful reproduction');
  await page.getByLabel('I have reviewed the selected evidence').check();
  await page.getByRole('combobox', { name: 'Report template', exact: true }).selectOption('accessibility');
  await page.getByRole('button', { name: 'Apply template', exact: true }).click();
  await page.getByRole('button', { name: 'Keep current text', exact: true }).click();
  await expect(page.getByLabel('Steps to reproduce', { exact: true })).toHaveValue('My careful reproduction');
  await page.getByRole('button', { name: 'Apply template', exact: true }).click();
  await page.getByRole('button', { name: 'Replace report text', exact: true }).click();
  await expect(page.getByLabel('Steps to reproduce', { exact: true })).toHaveValue(/assistive technology/);
  await expect(page.getByRole('combobox', { name: 'Severity', exact: true })).toHaveValue('high');
  await expect(page.getByLabel('Environment', { exact: true })).toHaveValue('Chrome on macOS, staging');
  await expect(page.getByRole('button', { name: 'Download reviewed JSON', exact: true })).toBeDisabled();
  expect(extensionErrors).toEqual([]);
});

test('restores a local report draft and exports only reviewed redacted JSON fields', async ({
  context,
  extensionId,
  extensionErrors,
}) => {
  const page = await context.newPage();
  await seedWorkspace(page, extensionId);
  await page.goto(`chrome-extension://${extensionId}/library/index.html?capture=capture-0&share=1`);
  await page.getByLabel('Steps to reproduce', { exact: true }).fill('Click checkout for alice@example.com');
  await page.getByLabel('Expected behavior', { exact: true }).fill('Order completes');
  await page.getByLabel('Actual behavior', { exact: true }).fill('Payment times out');
  await page.getByRole('combobox', { name: 'Severity', exact: true }).selectOption('critical');
  await page.getByLabel('Environment', { exact: true }).fill('Staging; api_key=private-environment');
  await page.getByLabel('Include diagnostic 1', { exact: true }).check();
  await page.getByLabel('Include source URL', { exact: true }).check();
  await page.getByText('Position a mask with the keyboard').click();
  await page.getByRole('button', { name: 'Add mask', exact: true }).click();
  await page.getByLabel('I have reviewed the selected evidence').check();
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.getByText('Report draft saved on this device.', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Restore draft', exact: true }).click();
  await expect(page.getByLabel('Steps to reproduce', { exact: true })).toHaveValue(
    'Click checkout for alice@example.com',
  );
  await expect(page.getByRole('combobox', { name: 'Severity', exact: true })).toHaveValue('critical');
  await expect(page.getByLabel('Environment', { exact: true })).toHaveValue('Staging; api_key=private-environment');
  await expect(page.getByLabel('Include diagnostic 1', { exact: true })).toBeChecked();
  await expect(page.getByLabel('Include diagnostic 2', { exact: true })).not.toBeChecked();
  await expect(page.getByLabel('Include source URL', { exact: true })).toBeChecked();
  await expect(page.getByRole('button', { name: 'Undo last mask', exact: true })).toBeEnabled();
  const exportJson = page.getByRole('button', { name: 'Download reviewed JSON', exact: true });
  await expect(exportJson).toBeDisabled();
  await page.getByLabel('I have reviewed the selected evidence').check();
  const [download] = await Promise.all([page.waitForEvent('download'), exportJson.click()]);
  const text = await readFile((await download.path())!, 'utf8');
  const exported = JSON.parse(text);
  expect(exported).toMatchObject({ schemaVersion: 1, report: { severity: 'critical', expected: 'Order completes' } });
  expect(exported.attachments).toEqual(['screenshot-1.png']);
  expect(exported.diagnostics).toHaveLength(1);
  expect(text).not.toMatch(
    /alice@example.com|private-environment|source-secret|private-diagnostic|secret-token|originalAssetId|previewAssetId|thumbnail|data:image/,
  );
  await page.getByRole('button', { name: 'Discard saved draft', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Restore draft', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Steps to reproduce', { exact: true })).toHaveValue(
    'Click checkout for alice@example.com',
  );
  expect(extensionErrors).toEqual([]);
});

test('rejects a saved report draft after the underlying capture changes', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await seedWorkspace(page, extensionId);
  await page.goto(`chrome-extension://${extensionId}/library/index.html?capture=capture-0&share=1`);
  await page.getByLabel('Steps to reproduce', { exact: true }).fill('Saved against the original revision');
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.getByText('Report draft saved on this device.', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Back to capture', exact: false }).click();
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('A changed capture');
  await page.getByRole('button', { name: 'Save details', exact: true }).click();
  await expect(page.getByText('Changes saved.', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Review & compose report', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('saved draft refers to an older capture');
  await expect(page.getByRole('button', { name: 'Restore draft', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Discard saved draft', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByLabel('Steps to reproduce', { exact: true })).toHaveValue('');
});

test('protects a newer report draft from stale saves and restores it explicitly across tabs', async ({
  context,
  extensionId,
  extensionErrors,
}) => {
  const first = await context.newPage();
  await seedWorkspace(first, extensionId);
  const reportUrl = `chrome-extension://${extensionId}/library/index.html?capture=capture-0&share=1`;
  await first.goto(reportUrl);
  const stale = await context.newPage();
  await stale.goto(reportUrl);
  await expect(stale.getByLabel('Steps to reproduce', { exact: true })).toBeVisible();
  await stale.getByLabel('Steps to reproduce', { exact: true }).fill('Unsaved investigation from the second tab');
  await first.getByLabel('Steps to reproduce', { exact: true }).fill('Newer evidence saved by the first tab');
  await first.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(first.getByText('Report draft saved on this device.', { exact: true })).toBeVisible();
  await expect(stale.getByRole('alert').filter({ hasText: 'Your current report is still open.' })).toBeVisible();
  await stale.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(
    stale.getByRole('alert').filter({ hasText: 'Restore it or explicitly replace it before saving.' }),
  ).toBeVisible();
  await expect(stale.getByLabel('Steps to reproduce', { exact: true })).toHaveValue(
    'Unsaved investigation from the second tab',
  );
  const saved = await first.evaluate(() => JSON.parse(localStorage.getItem('review-report-draft:capture-0')!));
  expect(saved.fields.steps).toBe('Newer evidence saved by the first tab');
  stale.once('dialog', dialog => dialog.accept());
  await stale.getByRole('button', { name: 'Restore draft', exact: true }).click();
  await expect(stale.getByLabel('Steps to reproduce', { exact: true })).toHaveValue(
    'Newer evidence saved by the first tab',
  );
  await expect(stale.getByRole('button', { name: 'Download reviewed JSON', exact: true })).toBeDisabled();
  await stale.getByLabel('Actual behavior', { exact: true }).fill('New finding after resolving the conflict');
  await stale.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(stale.getByText('Report draft saved on this device.', { exact: true })).toBeVisible();
  expect(extensionErrors).toEqual([]);
});

test('keeps the investigation tools usable across phone, tablet and desktop widths', async ({
  context,
  extensionId,
}, testInfo) => {
  const page = await context.newPage();
  await seedWorkspace(page, extensionId);
  for (const [name, query] of [
    ['library', ''],
    ['triage', '?capture=capture-0'],
    ['report', '?capture=capture-0&share=1'],
  ]) {
    await page.goto(`chrome-extension://${extensionId}/library/index.html${query}`);
    await page.getByRole('heading', { level: 1 }).waitFor();
    for (const width of [360, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`${name}-${width}.png`), fullPage: true });
    }
  }
});

for (const deletion of ['single', 'bulk']) {
  test(`removes the selected capture's report draft during ${deletion} deletion`, async ({ context, extensionId }) => {
    const page = await context.newPage();
    await seedWorkspace(page, extensionId);
    for (const id of ['capture-0', 'capture-1']) {
      await page.goto(`chrome-extension://${extensionId}/library/index.html?capture=${id}&share=1`);
      await page.getByLabel('Steps to reproduce', { exact: true }).fill(`Private draft for ${id}`);
      await page.getByRole('button', { name: 'Save draft', exact: true }).click();
      await expect(page.getByText('Report draft saved on this device.', { exact: true })).toBeVisible();
    }
    if (deletion === 'single') {
      await page.goto(`chrome-extension://${extensionId}/library/index.html?capture=capture-0`);
      await page.getByRole('button', { name: 'Delete capture', exact: true }).click();
      await page.getByRole('button', { name: 'Delete permanently', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Capture library', exact: true })).toBeVisible();
    } else {
      await page.goto(`chrome-extension://${extensionId}/library/index.html?storage=1`);
      await page.getByLabel('Select Checkout before', { exact: true }).check();
      await page.getByRole('button', { name: 'Review deletion', exact: true }).click();
      await page.getByRole('button', { name: 'Delete selected permanently', exact: true }).click();
      await expect(page.getByText('Deleted 1 selected items.', { exact: true })).toBeVisible();
    }
    expect(await page.evaluate(() => localStorage.getItem('review-report-draft:capture-0'))).toBeNull();
    expect(await page.evaluate(() => localStorage.getItem('review-report-draft:capture-1'))).toContain('Private draft');
  });
}
