import { RECORDING } from '@extension/shared';
import { captureSettingsStorage } from '@extension/storage';

import { pauseRecording, resumeRecording, stopRecording, toggleMic } from '../capture';
import { startPerformanceObserver } from '../utils/events/performance.observer';

let lastAutoScreenshotTime = 0;

export const addWindowEventListeners = () => {
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
    } else if (event.data.type === RECORDING.PAUSE) {
      pauseRecording();
    } else if (event.data.type === RECORDING.RESUME) {
      resumeRecording();
    } else if (event.data.type === RECORDING.STOP) {
      stopRecording();
    } else if (event.data.type === RECORDING.TOGGLE_MIC) {
      toggleMic();
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
