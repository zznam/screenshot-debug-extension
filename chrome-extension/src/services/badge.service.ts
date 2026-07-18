import { action, storage } from 'webextension-polyfill';

const CAPTURE_BADGE = '●';
const CAPTURE_STATE_KEY = 'capture-state-storage-key';
const CAPTURE_TAB_KEY = 'capture-tab-storage-key';

const STATE_COLORS: Record<string, string> = {
  capturing: '#22C55E',
};

const clearBadgeForTab = (tabId: number | null) => {
  action.setBadgeText({ text: '' }).catch(() => {});

  if (tabId) {
    action.setBadgeText({ tabId, text: '' }).catch(() => {});
  }
};

const setBadgeForTab = (tabId: number, color: string) => {
  action.setBadgeText({ tabId, text: CAPTURE_BADGE }).catch(() => {});
  action.setBadgeBackgroundColor({ tabId, color: 'transparent' }).catch(() => {});
  action.setBadgeTextColor({ tabId, color }).catch(() => {});
};

export const initBadgeListener = () => {
  let prevTabId: number | null = null;
  let tabId: number | null = null;
  let color = '';

  // Restore badge state on startup
  chrome.storage.local.get([CAPTURE_STATE_KEY, CAPTURE_TAB_KEY], result => {
    const state = result[CAPTURE_STATE_KEY] ?? 'idle';
    tabId = result[CAPTURE_TAB_KEY] ?? null;
    prevTabId = tabId;
    color = STATE_COLORS[state] ?? '';

    if (color && tabId) {
      setBadgeForTab(tabId, color);
    } else {
      clearBadgeForTab(tabId);
    }
  });

  storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (!changes[CAPTURE_STATE_KEY] && !changes[CAPTURE_TAB_KEY]) return;

    if (changes[CAPTURE_STATE_KEY]) {
      const state = changes[CAPTURE_STATE_KEY].newValue ?? 'idle';
      color = STATE_COLORS[state as keyof typeof STATE_COLORS] ?? '';
    }

    if (changes[CAPTURE_TAB_KEY]) {
      tabId = (changes[CAPTURE_TAB_KEY].newValue as number) ?? null;
    }

    // Clear badge on the previous tab (handles tab change and capture end)
    clearBadgeForTab(prevTabId);

    // Set badge on the current tab if actively capturing
    if (color && tabId) {
      setBadgeForTab(tabId, color);
    }

    prevTabId = tabId;
  });
};
