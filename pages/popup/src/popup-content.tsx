import { useState } from 'react';

import { useStorage } from '@extension/shared';
import { captureStateStorage } from '@extension/storage';

import { CaptureScreenshotGroup, DebugToggle } from './components/capture';
import { SettingsButton, SettingsContent } from './components/settings';
import { SlicesHistoryButton, SlicesHistoryContent } from './components/slices-history';
import { Header, BetaNotifier } from './components/ui';

export const PopupContent = () => {
  const [showSlicesHistory, setShowSlicesHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const captureModeAndState = useStorage(captureStateStorage);
  const captureState = captureModeAndState?.state ?? 'idle';

  const handleOnBackHistory = () => setShowSlicesHistory(false);
  const handleOnBackSettings = () => setShowSettings(false);

  if (showSlicesHistory) {
    return <SlicesHistoryContent onBack={handleOnBackHistory} />;
  }

  if (showSettings) {
    return <SettingsContent onBack={handleOnBackSettings} />;
  }

  return (
    <>
      <Header />
      <CaptureScreenshotGroup />
      {captureState === 'idle' && <DebugToggle />}
      {captureState === 'idle' && <SlicesHistoryButton onClick={() => setShowSlicesHistory(true)} />}
      {captureState === 'idle' && <SettingsButton onClick={() => setShowSettings(true)} />}
      <BetaNotifier />
    </>
  );
};
