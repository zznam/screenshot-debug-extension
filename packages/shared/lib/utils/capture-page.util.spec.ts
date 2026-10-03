import { describe, expect, it } from 'vitest';

import { getCapturePageError } from './capture-page.util.js';

describe('capture page availability', () => {
  it.each(['https://example.com', 'http://localhost:3000', 'https://chrome.google.com/other'])('accepts %s', url => {
    expect(getCapturePageError(url)).toBeNull();
  });
  it.each([
    'chrome://settings',
    'edge://settings',
    'about:blank',
    'file:///tmp/example.html',
    'data:text/html,hello',
    'chrome-extension://id/popup/index.html',
    'view-source:https://example.com',
    'invalid',
  ])('explains unsupported page %s', url => {
    expect(getCapturePageError(url)).toBeTruthy();
  });
  it('explains Chrome Web Store restrictions without matching lookalike hosts', () => {
    expect(getCapturePageError('https://chromewebstore.google.com/detail/test')).toContain('Web Store');
    expect(getCapturePageError('https://chrome.google.com/webstore/detail/test')).toContain('Web Store');
    expect(getCapturePageError('https://chromewebstore.google.com.example.test')).toBeNull();
    expect(getCapturePageError()).toContain('HTTP');
  });
});
