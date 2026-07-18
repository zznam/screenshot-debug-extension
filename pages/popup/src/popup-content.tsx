import { useState } from 'react';

import { t } from '@extension/i18n';
import { useStorage } from '@extension/shared';
import { captureStateStorage } from '@extension/storage';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@extension/ui';

import { CaptureScreenshotGroup, DebugToggle } from './components/capture';
import { RecordingControls } from './components/recording';
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
      <Tabs defaultValue={captureModeAndState?.mode === 'video' ? 'record' : 'screenshot'}>
        <TabsList className="mb-2 grid w-full grid-cols-2">
          <TabsTrigger value="screenshot">{t('screenshots')}</TabsTrigger>
          <TabsTrigger value="record">{t('recordTab')}</TabsTrigger>
        </TabsList>
        <TabsContent value="screenshot">
          <CaptureScreenshotGroup />
          {captureState === 'idle' && <DebugToggle />}
        </TabsContent>
        <TabsContent value="record">
          <RecordingControls />
        </TabsContent>
      </Tabs>
      {captureState === 'idle' && <SlicesHistoryButton onClick={() => setShowSlicesHistory(true)} />}
      {captureState === 'idle' && <SettingsButton onClick={() => setShowSettings(true)} />}
      <BetaNotifier />
    </>
  );
};
