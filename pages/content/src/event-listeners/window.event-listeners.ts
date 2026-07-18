import { captureSettingsStorage } from '@extension/storage';

import { startPerformanceObserver } from '../utils/events/performance.observer';

let lastAutoScreenshotTime = 0;

export const addWindowEventListeners = () => {
  /**
   * If you're injecting JavaScript into the webpage (e.g., to override fetch), remember:
   * The injected script does not have access to Chrome extension APIs (like chrome.runtime.sendMessage).
   * To communicate, inject the script and use window.postMessage to send data back to the content script.
   */
  window.addEventListener('message', event => {
    if (event.source !== window || !event.data.type) return;

    if (event.data.type === 'ADD_RECORD') {
      try {
        const payload = event.data.payload;
        chrome.runtime.sendMessage({ type: 'ADD_RECORD', data: payload });

        if (payload?.recordType === 'console' && payload?.method === 'error') {
          const now = Date.now();
          if (now - lastAutoScreenshotTime > 30000) {
            // 30s debounce
            lastAutoScreenshotTime = now;
            captureSettingsStorage.get().then(settings => {
              if (settings.autoScreenshotOnError) {
                chrome.runtime.sendMessage({ action: 'captureVisibleTab' }).then((res: any) => {
                  if (res?.success && res.dataUrl) {
                    window.dispatchEvent(
                      new CustomEvent('STORE_SCREENSHOT', {
                        detail: {
                          screenshots: [
                            {
                              id: crypto.randomUUID(),
                              src: res.dataUrl,
                              isPrimary: false,
                            },
                          ],
                        },
                      }),
                    );
                  }
                });
              }
            });
          }
        }
      } catch (err) {
        console.error('[sendMessage error]', chrome.runtime.id, err);
      }
    }
  });

  startPerformanceObserver(metric => {
    try {
      chrome.runtime.sendMessage({
        type: 'ADD_RECORD',
        data: {
          recordType: 'performance',
          url: window.location.href,
          type: metric.type,
          data: metric,
        },
      });
    } catch (e) {
      // Ignore extension context invalidated errors
    }
  });
};
