const injectableUrlPattern = /^(https?|file):/;

export const ensureContentScripts = async (tabId: number): Promise<void> => {
  const tab = await chrome.tabs.get(tabId);

  if (!tab.url || !injectableUrlPattern.test(tab.url)) {
    throw new Error('Open a regular website before starting a capture.');
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    func: () => document.getElementById('brie-root')?.remove(),
  });
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content/index.iife.js'],
  });
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content-ui/index.iife.js'],
  });
  await chrome.scripting.insertCSS({
    target: { tabId },
    files: ['content.css'],
  });
};
