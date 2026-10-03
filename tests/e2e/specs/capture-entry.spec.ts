import { expect, test } from '../fixtures/extension.js';

test('registers capture commands and captures through the shared background gateway', async ({
  context,
  serviceWorker,
  extensionId,
  extensionErrors,
}) => {
  const commands = await serviceWorker.evaluate(
    () => new Promise<chrome.commands.Command[]>(resolve => chrome.commands.getAll(resolve)),
  );
  expect(
    commands
      .filter(command => command.name?.startsWith('capture-'))
      .map(command => command.name)
      .sort(),
  ).toEqual(['capture-area', 'capture-full-page', 'capture-viewport']);
  const url = 'http://127.0.0.1:4174/?capture-gateway';
  const target = await context.newPage();
  await target.goto(url);
  await expect(target.locator('#brie-root')).toHaveCount(1);
  const sourceId = await serviceWorker.evaluate(async source => {
    const tabs = await chrome.tabs.query({});
    return tabs.find(tab => tab.url === source)!.id!;
  }, url);
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup/index.html`);
  await expect(popup.getByRole('button', { name: 'Customize capture shortcuts' })).toBeVisible();
  await target.bringToFront();
  const response = await popup.evaluate(
    async id => chrome.runtime.sendMessage({ type: 'START_SCREENSHOT_CAPTURE', tabId: id, captureType: 'viewport' }),
    sourceId,
  );
  expect(response).toEqual({ ok: true });
  await expect(target.getByTestId('screenshot-editor')).toBeVisible();
  const competing = await popup.evaluate(
    async id => chrome.runtime.sendMessage({ type: 'START_SCREENSHOT_CAPTURE', tabId: id, captureType: 'area' }),
    sourceId,
  );
  expect(competing).toMatchObject({
    ok: false,
    error: 'Finish or discard the current capture before starting another.',
  });
  await expect(target.getByTestId('screenshot-editor')).toBeVisible();
  expect(extensionErrors).toEqual([]);
});

test('uses keyboard-accessible capture buttons and shared initialization recovery', async ({
  context,
  serviceWorker,
  extensionId,
}) => {
  const url = 'http://127.0.0.1:4174/?popup-buttons';
  const target = await context.newPage();
  await target.goto(url);
  const sourceId = await serviceWorker.evaluate(async source => {
    const tabs = await chrome.tabs.query({});
    return tabs.find(tab => tab.url === source)!.id!;
  }, url);
  const popup = await context.newPage();
  await popup.addInitScript(id => {
    const api = chrome.tabs as unknown as { query: (details: chrome.tabs.QueryInfo) => Promise<chrome.tabs.Tab[]> };
    const query = api.query.bind(api);
    api.query = async details => (details.active ? [await chrome.tabs.get(id)] : query(details));
  }, sourceId);
  await popup.goto(`chrome-extension://${extensionId}/popup/index.html`);
  await target.bringToFront();
  await expect(popup.getByRole('button', { name: 'Viewport', exact: true })).toBeVisible();
  await popup.getByRole('button', { name: 'Viewport', exact: true }).focus();
  await popup.getByRole('button', { name: 'Viewport', exact: true }).press('Enter');
  await expect(target.getByTestId('screenshot-editor')).toBeVisible();
  const session = await serviceWorker.evaluate(async () => chrome.storage.local.get('capture-state-storage-key'));
  expect(session['capture-state-storage-key']).toMatchObject({ mode: 'screenshot', state: 'unsaved' });
});
