import { useEffect, useState } from 'react';

import { t } from '@extension/i18n';
import { RECORDING, REWIND, useStorage } from '@extension/shared';
import type { CaptureOptions } from '@extension/shared';
import {
  captureStateStorage,
  captureTabStorage,
  recordingSettingsStorage,
  rewindSettingsStorage,
} from '@extension/storage';
import { Alert, AlertDescription, Button, Icon, Switch } from '@extension/ui';

import { sendMessageToTab } from '@src/utils';

const isRestrictedUrl = (url = '') =>
  ['chrome:', 'edge:', 'about:', 'chrome-extension:', 'view-source:'].some(scheme => url.startsWith(scheme));

export const RecordingControls = () => {
  const capture = useStorage(captureStateStorage);
  const captureTabId = useStorage(captureTabStorage);
  const recordingSettings = useStorage(recordingSettingsStorage);
  const rewindSettings = useStorage(rewindSettingsStorage);

  const [activeTab, setActiveTab] = useState<chrome.tabs.Tab | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => setActiveTab(tab ?? null));
  }, []);

  const sendToActiveTab = async (action: string, extra: Record<string, unknown> = {}) => {
    if (!activeTab?.id) throw new Error(t('noActiveTabForRewind'));
    return await sendMessageToTab<{ ok?: boolean; error?: string }>(activeTab.id, { action, ...extra });
  };

  const startRecording = async (options: CaptureOptions) => {
    if (!activeTab?.id || isRestrictedUrl(activeTab.url)) {
      setError(t('navigateToWebsite'));
      return;
    }

    setError(null);
    try {
      await Promise.all([
        captureTabStorage.setCaptureTabId(activeTab.id),
        captureStateStorage.setModeAndState('video', 'preparing'),
      ]);
      const response = await sendToActiveTab(RECORDING.START, { options });
      if (!response?.ok) throw new Error(response?.error ?? t('unexpectedError'));
      await chrome.tabs.update(activeTab.id, { active: true });
      window.close();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(message);
      await Promise.all([captureStateStorage.setVideoState('idle'), captureTabStorage.setCaptureTabId(null)]);
    }
  };

  const sendRecordingCommand = async (action: string) => {
    setError(null);
    try {
      await sendToActiveTab(action);
      window.close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const setMicEnabled = async (enabled: boolean) => {
    await recordingSettingsStorage.setMicEnabled(enabled);
    if (enabled && recordingSettings.mic.permission !== 'granted') {
      await chrome.tabs.create({ url: chrome.runtime.getURL('mic-permission/index.html') });
    }
  };

  const setRewindEnabled = async (enabled: boolean) => {
    await rewindSettingsStorage.setRewindEnabled(enabled);
    if (activeTab?.id && !isRestrictedUrl(activeTab.url)) {
      await chrome.tabs.sendMessage(activeTab.id, { action: REWIND.SET_ENABLED, enabled }).catch(() => undefined);
    }
  };

  const captureLastMinute = async () => {
    if (!activeTab?.id) return;
    setError(null);
    try {
      const frozen = await chrome.runtime.sendMessage({ type: REWIND.FREEZE, tabId: activeTab.id });
      if (frozen?.status === 'error') throw new Error(frozen.message);
      await sendToActiveTab(REWIND.OPEN_REVIEW, { payload: frozen });
      await chrome.tabs.update(activeTab.id, { active: true });
      window.close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const isRecordingTab = capture.mode === 'video' && captureTabId === activeTab?.id;
  const isRecording = isRecordingTab && ['preparing', 'capturing', 'paused'].includes(capture.state);

  return (
    <div className="space-y-3">
      {error && (
        <Alert variant="destructive">
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      )}

      {isRestrictedUrl(activeTab?.url) && (
        <Alert>
          <AlertDescription className="text-xs">{t('navigateToWebsite')}</AlertDescription>
        </Alert>
      )}

      {isRecording ? (
        <div className="grid grid-cols-2 gap-2">
          {capture.state === 'paused' ? (
            <Button onClick={() => sendRecordingCommand(RECORDING.RESUME)}>
              <Icon name="Play" className="mr-2 size-4" /> {t('resumeRecording')}
            </Button>
          ) : (
            <Button variant="outline" onClick={() => sendRecordingCommand(RECORDING.PAUSE)}>
              <Icon name="Pause" className="mr-2 size-4" /> {t('pauseRecording')}
            </Button>
          )}
          <Button variant="destructive" onClick={() => sendRecordingCommand(RECORDING.STOP)}>
            <Icon name="Square" className="mr-2 size-4" /> {t('stopRecording')}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button disabled={isRestrictedUrl(activeTab?.url)} onClick={() => startRecording({ captureType: 'tab' })}>
            <Icon name="PanelsTopLeft" className="mr-2 size-4" /> {t('recordTab')}
          </Button>
          <Button
            variant="outline"
            disabled={isRestrictedUrl(activeTab?.url)}
            onClick={() => startRecording({ captureType: 'desktop' })}>
            <Icon name="Monitor" className="mr-2 size-4" /> {t('recordDesktop')}
          </Button>
        </div>
      )}

      <div className="rounded-lg border p-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span>{t('enableMic')}</span>
          <Switch checked={recordingSettings.mic.enabled} onCheckedChange={setMicEnabled} disabled={isRecording} />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span>{t('toggleRewind')}</span>
          <Switch checked={rewindSettings.rewind.enabled} onCheckedChange={setRewindEnabled} />
        </div>
      </div>

      {rewindSettings.rewind.enabled && !isRecording && (
        <Button className="w-full" variant="secondary" onClick={captureLastMinute}>
          <Icon name="History" className="mr-2 size-4" /> {t('captureLastMinute')}
        </Button>
      )}
    </div>
  );
};
