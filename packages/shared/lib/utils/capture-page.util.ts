export const getCapturePageError = (url?: string): string | null => {
  if (!url) return 'Open a regular HTTP or HTTPS website before starting a capture.';
  try {
    const page = new URL(url);
    if (!['http:', 'https:'].includes(page.protocol)) {
      return 'Open a regular HTTP or HTTPS website before starting a capture.';
    }
    if (
      page.hostname === 'chromewebstore.google.com' ||
      (page.hostname === 'chrome.google.com' && page.pathname.startsWith('/webstore'))
    ) {
      return 'Chrome blocks extensions on the Chrome Web Store. Open another website to capture it.';
    }
    return null;
  } catch {
    return 'This page URL cannot be captured. Open a regular HTTP or HTTPS website.';
  }
};
