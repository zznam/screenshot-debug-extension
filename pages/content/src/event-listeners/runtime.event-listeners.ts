import { CAPTURE, CONTENT_SCRIPT, RECORDING, REWIND, UI } from '@extension/shared';

import {
  applyEnabledState,
  beginPreparingRecording,
  cleanup,
  pauseRecording,
  resumeRecording,
  startScreenshotCapture,
  stopRecording,
  toggleMic,
} from '@src/capture';

export const addRuntimeEventListeners = () => {
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === CONTENT_SCRIPT.PING) {
      sendResponse({ ok: true, ready: true });
      return undefined;
    }

    if (msg.action === 'AUTH_STATUS') {
      window.dispatchEvent(new CustomEvent('AUTH_STATUS', { detail: msg.payload }));
    }

    if (msg.action === 'START_SCREENSHOT') {
      window.dispatchEvent(new CustomEvent('metadata'));

      void startScreenshotCapture(msg.payload)
        .then(() => sendResponse({ ok: true }))
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          console.error('[Screenshot & Debug] Screenshot capture failed:', error);
          sendResponse({ ok: false, error: message });
        });

      return true;
    }

    if (msg.action === RECORDING.START) {
      beginPreparingRecording(msg.options);
      sendResponse({ ok: true });
    }

    if (msg.action === RECORDING.PAUSE) pauseRecording();
    if (msg.action === RECORDING.RESUME) resumeRecording();
    if (msg.action === RECORDING.STOP) stopRecording();
    if (msg.action === RECORDING.TOGGLE_MIC) void toggleMic();

    if (msg.action === REWIND.SET_ENABLED) {
      void applyEnabledState(Boolean(msg.enabled));
      sendResponse({ ok: true });
    }

    if (msg.action === REWIND.OPEN_REVIEW) {
      window.dispatchEvent(new CustomEvent(REWIND.OPEN_REVIEW, { detail: msg.payload }));
      sendResponse({ ok: true });
    }

    if (msg.action === CAPTURE.EXIT || msg.action === 'EXIT_CAPTURE') {
      cleanup();
      window.dispatchEvent(new CustomEvent(UI.CLOSE_MODAL));
      sendResponse({ ok: true });
    }

    if (msg.action === UI.CLOSE_MODAL || msg.action === 'CLOSE_MODAL') {
      window.dispatchEvent(new CustomEvent(UI.CLOSE_MODAL));
      sendResponse({ ok: true });
    }

    return undefined;
  });
};
