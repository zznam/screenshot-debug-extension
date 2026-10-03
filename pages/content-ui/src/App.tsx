import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuid } from 'uuid';

import { t } from '@extension/i18n';
import type { Screenshot } from '@extension/shared';
import { REWIND, UI, VIDEO, useStorage } from '@extension/shared';
import {
  annotationsHistoryStorage,
  annotationsRedoStorage,
  annotationsStorage,
  captureNotifyStorage,
  captureStateStorage,
  captureTabStorage,
  librarySettingsStorage,
  themeStorage,
} from '@extension/storage';
import { store, ReduxProvider } from '@extension/store';
import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast,
  ToasterProvider,
  TooltipProvider,
} from '@extension/ui';

import { MinimizedPreview } from './components/dialog-view';
import { LibrarySave } from './components/dialog-view/library-save.ui';
import { RecordingOverlay } from './components/recording-view';
import { VideoPlayer } from './components/recording-view/ui/video-player.ui';
import { RewindPlayer } from './components/recording-view/views/rewind-player.view';
import Content from './content';
import type { TrimRange, VideoFormat, VideoSource } from './models';
import { createLibrarySaveSession, prepareLibrarySession } from './utils/library-capture.util';
import { exportRecordingVideo } from './utils/recording';

const renderInactiveScreenshot = () => null;
const ignoreSavingChange = () => undefined;

export default function App() {
  const captureNotifyState = useStorage(captureNotifyStorage);
  const theme = useStorage(themeStorage);
  const libraryMode = useStorage(librarySettingsStorage);
  const [minimized, setMinimized] = useState(true);
  const [video, setVideo] = useState<VideoSource>();
  const [events, setEvents] = useState<unknown[] | null>(null);
  const [isExportingVideo, setExportingVideo] = useState(false);
  const [screenshots, setScreenshots] = useState<Screenshot[]>();
  const [activeScreenshotId, setActiveScreenshotId] = useState<string | null>();
  const [idempotencyKey, setIdempotencyKey] = useState<string>(uuid());
  const librarySession = useRef(createLibrarySaveSession());
  const minimizedCloseGuard = useRef<(() => Promise<boolean>) | null>(null);
  const setMinimizedCloseGuard = useCallback((guard: (() => Promise<boolean>) | null) => {
    minimizedCloseGuard.current = guard;
  }, []);
  const leaveMinimizedPreview = async (action: () => void) => {
    if (!minimizedCloseGuard.current || (await minimizedCloseGuard.current())) action();
  };

  useEffect(() => {
    window.addEventListener('DISPLAY_MODAL', handleOnDisplay);
    window.addEventListener(UI.CLOSE_MODAL, handleOnClose);
    window.addEventListener('STORE_SCREENSHOT', handleOnStoreScreenshot);
    window.addEventListener('AUTH_STATUS', handleOnAuthStatus);
    window.addEventListener(VIDEO.CAPTURED, handleOnVideoCaptured as unknown as EventListener);
    window.addEventListener(REWIND.OPEN_REVIEW, handleOnOpenRewind as unknown as EventListener);

    return () => {
      window.removeEventListener('DISPLAY_MODAL', handleOnDisplay);
      window.removeEventListener(UI.CLOSE_MODAL, handleOnClose);
      window.removeEventListener('STORE_SCREENSHOT', handleOnStoreScreenshot);
      window.removeEventListener('AUTH_STATUS', handleOnAuthStatus);
      window.removeEventListener(VIDEO.CAPTURED, handleOnVideoCaptured as unknown as EventListener);
      window.removeEventListener(REWIND.OPEN_REVIEW, handleOnOpenRewind as unknown as EventListener);
    };
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleOnAuthStatus = async (event: any) => {
    if (event.detail.ok) toast.success(t('authCompleted'));
    else toast.error(t('authFailed'));
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleOnStoreScreenshot = (event: any) => {
    void prepareLibrarySession(librarySession.current).catch(() => undefined);
    handleOnMinimize();
    const incoming = (event.detail.screenshots as Screenshot[]).map(screenshot => ({
      ...screenshot,
      id: screenshot.id ?? uuid(),
    }));
    setScreenshots(screenshots => [...(screenshots ?? []), ...incoming]);
    setActiveScreenshotId(activeId => activeId ?? incoming[0]?.id ?? null);

    if (!captureNotifyState?.notified) {
      setTimeout(async () => {
        toast.message(t('screenshotCaptured'), {
          duration: 5000,
          closeButton: true,
          description: t('screenshotCapturedDescription'),
        });

        await captureNotifyStorage.set({ notified: true });
      }, 1000);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleOnDisplay = async (event: any) => {
    librarySession.current = createLibrarySaveSession();
    setIdempotencyKey(uuid());
    void prepareLibrarySession(librarySession.current).catch(() => undefined);
    const incoming = (event.detail.screenshots as Screenshot[]).map(screenshot => ({
      ...screenshot,
      id: screenshot.id ?? uuid(),
    }));
    setScreenshots(incoming);
    setActiveScreenshotId(incoming[0]?.id ?? null);
    setMinimized(false);
    await captureStateStorage.setScreenshotState('unsaved');
  };

  const handleOnVideoCaptured = async (event: CustomEvent<VideoSource>) => {
    setVideo(event.detail);
    setEvents(null);
    await captureStateStorage.setVideoState('unsaved');

    try {
      const frozen = await chrome.runtime.sendMessage({ type: REWIND.FREEZE });
      if (Array.isArray(frozen?.events)) setEvents(frozen.events);
    } catch (error) {
      console.warn('[Screenshot & Debug] Unable to freeze rewind events:', error);
    }
  };

  const handleOnOpenRewind = (event: CustomEvent<{ events?: unknown[] }>) => {
    setVideo(undefined);
    setEvents(Array.isArray(event.detail?.events) ? event.detail.events : []);
    void captureStateStorage.setModeAndState('video', 'unsaved');
  };

  const closeRecordingReview = useCallback(async () => {
    setVideo(undefined);
    setEvents(null);
    await Promise.all([captureStateStorage.setVideoState('idle'), captureTabStorage.setCaptureTabId(null)]);
  }, []);

  const exportVideo = useCallback(
    async (format: VideoFormat, trim: TrimRange) => {
      if (!video) return;
      setExportingVideo(true);
      try {
        const result = await exportRecordingVideo(video.blob, video.durationMs / 1000, {
          format,
          trim,
          filenameBase: `recording-${Date.now()}`,
        });
        const url = URL.createObjectURL(result.blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = result.file.name;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (error) {
        console.error('[Screenshot & Debug] Video export failed:', error);
        toast.error(error instanceof Error ? error.message : t('unexpectedError'));
      } finally {
        setExportingVideo(false);
      }
    },
    [video],
  );

  const handleOnClose = useCallback(async () => {
    librarySession.current = createLibrarySaveSession();
    setIdempotencyKey(uuid());
    setScreenshots([]);
    setMinimized(false);

    await Promise.all([
      captureStateStorage.setScreenshotState('idle'),
      captureTabStorage.setCaptureTabId(null),
      annotationsStorage.clearAll(),
      annotationsRedoStorage.clearAll(),
      annotationsHistoryStorage.clearAll(),
    ]);
  }, []);

  const handleOnSelectScreenshot = useCallback(
    (id: string) => {
      if (id !== activeScreenshotId) setActiveScreenshotId(id);
    },
    [activeScreenshotId],
  );

  const handleOnDeleteScreenshot = useCallback(
    async (id: string) => {
      setScreenshots(prev => {
        const next = prev?.filter(s => s.id !== id);

        if (activeScreenshotId === id) setActiveScreenshotId(next?.[0]?.id ?? null);

        return next;
      });

      await Promise.all([
        annotationsStorage.deleteAnnotations(id),
        annotationsRedoStorage.deleteAnnotations(id),
        annotationsHistoryStorage.deleteAnnotations(id),
      ]);
    },
    [activeScreenshotId],
  );

  const handleOnMinimize = async () => {
    await captureStateStorage.setScreenshotState('capturing');
    setMinimized(true);
  };
  const handleOnEdit = async () => {
    setActiveScreenshotId(screenshots?.[0]?.id);

    setMinimized(false);

    await captureStateStorage.setScreenshotState('unsaved');
  };

  return (
    <div id="brie-content" className={cn(theme, 'relative')}>
      <ToasterProvider theme={theme} />

      <ReduxProvider store={store}>
        <TooltipProvider>
          <RecordingOverlay />

          <Dialog open={Boolean(video || events)} onOpenChange={open => !open && void closeRecordingReview()}>
            <DialogContent className="flex h-[80vh] w-[90vw] max-w-none flex-col overflow-hidden p-4">
              <div className="flex items-center justify-between pr-8">
                <DialogTitle className="text-lg font-semibold">
                  {video ? t('recordingInProgress') : t('captureLastMinute')}
                </DialogTitle>
                <Button variant="outline" size="sm" onClick={() => void closeRecordingReview()}>
                  {t('close')}
                </Button>
              </div>
              <Tabs defaultValue={video ? 'video' : 'rewind'} className="flex min-h-0 flex-1 flex-col">
                {video && events && (
                  <TabsList className="grid w-64 grid-cols-2">
                    <TabsTrigger value="video">Video</TabsTrigger>
                    <TabsTrigger value="rewind">Rewind</TabsTrigger>
                  </TabsList>
                )}
                {video && (
                  <TabsContent value="video" className="min-h-0 flex-1">
                    <VideoPlayer
                      video={video}
                      disableExport={isExportingVideo}
                      onExport={(format, trim) => void exportVideo(format, trim)}
                      onTrimUpdate={() => undefined}
                    />
                  </TabsContent>
                )}
                <TabsContent value="rewind" className="min-h-0 flex-1">
                  <RewindPlayer events={events} enableTrim showEventsMenu className="h-full" />
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>

          {!!screenshots?.length &&
            (minimized ? (
              <>
                <MinimizedPreview
                  screenshots={screenshots}
                  onEdit={() => void leaveMinimizedPreview(handleOnEdit)}
                  onDiscard={() => void leaveMinimizedPreview(handleOnClose)}
                />
                {libraryMode === 'automatic' && (
                  <div className="fixed bottom-[212px] right-4 z-[2000000] max-w-[min(380px,calc(100vw-32px))] overflow-hidden rounded-lg shadow-xl">
                    <LibrarySave
                      session={librarySession.current}
                      title={librarySession.current.title}
                      screenshots={screenshots}
                      activeId={activeScreenshotId || ''}
                      renderActive={renderInactiveScreenshot}
                      onSavingChange={ignoreSavingChange}
                      onBeforeCloseReady={setMinimizedCloseGuard}
                    />
                  </div>
                )}
              </>
            ) : (
              <Content
                key={idempotencyKey}
                librarySession={librarySession.current}
                idempotencyKey={idempotencyKey}
                activeScreenshotId={activeScreenshotId || ''}
                screenshots={screenshots}
                onClose={handleOnClose}
                onMinimize={handleOnMinimize}
                onDeleteScreenshot={handleOnDeleteScreenshot}
                onSelectScreenshot={handleOnSelectScreenshot}
              />
            ))}
        </TooltipProvider>
      </ReduxProvider>
    </div>
  );
}
