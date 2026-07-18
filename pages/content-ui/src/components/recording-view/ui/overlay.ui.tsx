import { useEffect, useState } from 'react';
import type { FC } from 'react';

import { t } from '@extension/i18n';
import { RECORDING, useStorage } from '@extension/shared';
import type { BaseStorage, CaptureState, VideoRecordingState } from '@extension/storage';
import { captureStateStorage, captureTabStorage } from '@extension/storage';
import { Button } from '@extension/ui';

import type { AnnotationTool } from '@src/models';
import { requestActiveTab } from '@src/utils/recording';

import { RecordingToolbar } from './toolbar.ui';
import { BlurLayer } from '../views/blur-layer.view';
import { HighlighterLayer } from '../views/highlighter-layer.view';

export const RecordingOverlay: FC = () => {
  const captureTabId = useStorage<BaseStorage<number | null>>(captureTabStorage);
  const { state, mode } = useStorage<BaseStorage<CaptureState>>(captureStateStorage);

  const [tool, setTool] = useState<AnnotationTool>('none');
  const [showToolbar, setShowToolbar] = useState(false);

  useEffect(() => {
    if (state !== 'capturing' && mode !== 'video') return;

    const requestTab = async () => {
      const tab = await requestActiveTab();

      setShowToolbar(!!(tab?.id && captureTabId === tab.id));
    };

    requestTab();
  }, [captureTabId, mode, state]);

  if (mode !== 'video') return null;
  if (!showToolbar) return null;

  if (state === 'preparing') {
    return (
      <div className="pointer-events-auto fixed inset-0 z-[2147483646] flex items-center justify-center bg-black/50 p-4">
        <div className="bg-background text-foreground w-full max-w-sm rounded-2xl border p-6 text-center shadow-2xl">
          <h2 className="text-lg font-semibold">{t('preparingRecording')}</h2>
          <p className="text-muted-foreground mt-2 text-sm">{t('videoRecordingDescription')}</p>
          <div className="mt-5 flex justify-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                void Promise.all([captureStateStorage.setVideoState('idle'), captureTabStorage.setCaptureTabId(null)]);
              }}>
              {t('close')}
            </Button>
            <Button onClick={() => window.dispatchEvent(new Event(RECORDING.COUNTDOWN_FINISHED))}>
              {t('startRecording')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="pointer-events-auto fixed inset-0 z-[2147483646] flex items-center justify-center bg-black/50 p-4">
        <div className="bg-background text-foreground w-full max-w-sm rounded-2xl border p-6 text-center shadow-2xl">
          <h2 className="text-lg font-semibold">{t('unexpectedError')}</h2>
          <p className="text-muted-foreground mt-2 text-sm">{t('micPermissionDenied')}</p>
          <Button
            className="mt-5"
            onClick={() => {
              void Promise.all([captureStateStorage.setVideoState('idle'), captureTabStorage.setCaptureTabId(null)]);
            }}>
            {t('close')}
          </Button>
        </div>
      </div>
    );
  }

  if (['unsaved', 'idle'].includes(state)) return null;

  return (
    <>
      <RecordingToolbar state={state as VideoRecordingState} tool={tool} onToolChange={setTool} />

      <BlurLayer active={tool === 'blur'} />
      <HighlighterLayer active={tool === 'highlighter'} />
    </>
  );
};
