import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { t } from '@extension/i18n';
import type { AiDebugResponse, DownloadRequest, Screenshot } from '@extension/shared';
import { AI_DEBUG, useStorage } from '@extension/shared';
import { annotationsStorage, captureSettingsStorage, debugModeStorage, themeStorage } from '@extension/storage';
import { useAppDispatch, triggerCanvasAction } from '@extension/store';
import { Dialog, DialogContent, DialogTitle, cn, toast } from '@extension/ui';

import { CanvasContainerView } from './components/annotation-view';
import { Footer, Header, LeftSidebar } from './components/annotation-view/ui';
import { LibrarySave } from './components/dialog-view/library-save.ui';
import { defaultNavElement } from './constants';
import { useElementSize, useViewportSize } from './hooks';
import type { ActiveElement } from './models';
import { mergeScreenshot } from './utils/annotation';
import { copyBase64ImageToClipboard } from './utils/base64-to-clipboard.util';
import { downloadCapture } from './utils/download-capture.util';
import { encodeScreenshot } from './utils/encode-screenshot.util';
import type { LibrarySaveSession } from './utils/library-capture.util';

const SM_BREAKPOINT = 640;
const LG_BREAKPOINT = 1024;

interface ContentProps {
  librarySession: LibrarySaveSession;
  idempotencyKey: string;
  activeScreenshotId: string;
  screenshots: Screenshot[];
  onClose: () => void;
  onMinimize: () => void;
  onDeleteScreenshot: (id: string) => void;
  onSelectScreenshot(id: string): void;
}

const Content = ({
  librarySession,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  idempotencyKey,
  screenshots = [],
  activeScreenshotId,
  onClose,
  onMinimize,
  onDeleteScreenshot,
  onSelectScreenshot,
}: ContentProps) => {
  const dispatch = useAppDispatch();
  const theme = useStorage(themeStorage);
  const bgLight = chrome.runtime.getURL('content-ui/annotation-bg-light.png');
  const bgDark = chrome.runtime.getURL('content-ui/annotation-bg-dark.png');
  const bg = theme === 'dark' ? bgDark : bgLight;

  const { width: viewportWidth } = useViewportSize();
  const { ref: canvasRef, width: canvasWidth, height: canvasHeight } = useElementSize<HTMLDivElement>();

  const [isFullScreen, setFullScreen] = useState(viewportWidth < SM_BREAKPOINT);
  const [title, setTitle] = useState(librarySession.title);
  const [activeElement, setActiveElement] = useState<ActiveElement>(defaultNavElement);
  const [isStartingAiDebug, setStartingAiDebug] = useState(false);
  const [isDownloading, setDownloading] = useState(false);
  const [isLibrarySaving, setLibrarySaving] = useState(false);
  const downloadInFlight = useRef(false);
  const aiRendererRef = useRef<(() => string) | null>(null);
  const getLibraryRenderer = useCallback(() => aiRendererRef.current, []);
  const libraryCloseGuard = useRef<(() => Promise<boolean>) | null>(null);
  const setLibraryCloseGuard = useCallback((guard: (() => Promise<boolean>) | null) => {
    libraryCloseGuard.current = guard;
  }, []);
  const closeEditor = useCallback(async () => {
    if (!libraryCloseGuard.current || (await libraryCloseGuard.current())) onClose();
  }, [onClose]);

  const isLg = canvasWidth >= LG_BREAKPOINT;
  const hasShots = screenshots.length > 1;
  const isDialogOpen = !!screenshots.length;

  const [isLeftSidebarOpen, setLeftSidebarOpen] = useState(() => hasShots && isLg);

  const activeScreenshot = useMemo(
    () => screenshots.find(s => s.id === activeScreenshotId),
    [activeScreenshotId, screenshots],
  );

  useEffect(() => {
    setLeftSidebarOpen(hasShots && isLg);
  }, [isLg, hasShots]);

  const handleOnElement = (element: ActiveElement) => setActiveElement(element);

  const handleOnDownload = async () => {
    if (downloadInFlight.current) return;
    downloadInFlight.current = true;
    setDownloading(true);
    try {
      const timestamp = Date.now();
      const screenshotName = `${location.host}-${timestamp}`.replaceAll('.', '-');
      const [settings, saveDebugLog] = await Promise.all([
        captureSettingsStorage.get(),
        debugModeStorage.getDebugMode(),
      ]);
      const preparedScreenshots = [];
      for (const screenshot of screenshots) {
        let src = screenshot.id === activeScreenshotId ? (aiRendererRef.current?.() ?? screenshot.src) : screenshot.src;
        if (screenshot.id !== activeScreenshotId || !aiRendererRef.current) {
          const stored = await annotationsStorage.getAnnotations(screenshot.id!);
          if (stored?.objects?.length && stored.meta?.sizes?.natural) {
            const { width, height } = stored.meta.sizes.natural;
            const file = await mergeScreenshot({
              screenshot,
              objects: stored.objects,
              parentWidth: width,
              parentHeight: height,
            });
            src = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = () => reject(reader.error ?? new Error('Could not read the annotated screenshot.'));
              reader.readAsDataURL(file);
            });
          }
        }
        preparedScreenshots.push({
          src: await encodeScreenshot(src, settings.screenshotFormat, settings.screenshotQuality),
          isPrimary: screenshot.isPrimary,
        });
      }
      const request: DownloadRequest = {
        type: settings.exportFormat === 'zip' ? 'DOWNLOAD_ZIP' : 'DOWNLOAD_ASSETS',
        payload: {
          screenshots: preparedScreenshots,
          name: screenshotName,
          timestamp,
          host: location.host,
          url: location.href,
          title: title === 'Untitled report' ? document.title : title,
          saveDebugLog,
        },
      };
      await downloadCapture(request);
      await closeEditor();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The download could not be started.';
      toast.error(`Download failed: ${message}`);
      console.error('[download] Failed:', error);
    } finally {
      downloadInFlight.current = false;
      setDownloading(false);
    }
  };

  const handleOnCopy = async () => {
    try {
      if (activeScreenshot?.src) {
        const src = aiRendererRef.current?.() ?? activeScreenshot.src;
        await copyBase64ImageToClipboard(await encodeScreenshot(src, 'png'));
        toast.success('Screenshot copied to clipboard!');
      }
    } catch (e) {
      toast.error('Failed to copy screenshot');
      console.error(e);
    }
  };

  const handleOnAiDebug = async () => {
    if (!activeScreenshot) return;
    setStartingAiDebug(true);
    try {
      const stored = await annotationsStorage.getAnnotations(activeScreenshot.id!);
      let screenshotDataUrl = aiRendererRef.current?.() ?? activeScreenshot.src;

      if (!aiRendererRef.current && stored?.objects?.length && stored.meta?.sizes?.natural) {
        const { width, height } = stored.meta.sizes.natural;
        const annotatedFile = await mergeScreenshot({
          screenshot: activeScreenshot,
          objects: stored.objects,
          parentWidth: width,
          parentHeight: height,
        });
        screenshotDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () =>
            typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Invalid annotated image.'));
          reader.onerror = () => reject(reader.error ?? new Error('Could not read the annotated image.'));
          reader.readAsDataURL(new Blob([annotatedFile], { type: 'image/png' }));
        });
      }

      const response = (await chrome.runtime.sendMessage({
        type: AI_DEBUG.START_ANNOTATED,
        screenshotDataUrl,
      })) as AiDebugResponse;
      if (response.status === 'error') throw new Error(response.message);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not start AI Debug.';
      toast.error(`AI Debug failed: ${message}`);
    } finally {
      setStartingAiDebug(false);
    }
  };

  const handleAiRendererReady = useCallback((renderer: (() => string) | null) => {
    aiRendererRef.current = renderer;
  }, []);

  const handleOnOpenSidebar = (open: boolean) => {
    setLeftSidebarOpen(open);
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={() => void closeEditor()} modal>
      <DialogContent
        data-testid="screenshot-editor"
        aria-describedby="Annotation View"
        onEscapeKeyDown={e => e.preventDefault()}
        onPointerDownOutside={e => e.preventDefault()}
        className={cn(
          'bg-background text-foreground grid max-w-none grid-rows-[auto_auto_minmax(0,1fr)_auto] !gap-0 border-none bg-repeat p-0',
          {
            'size-full !rounded-none': isFullScreen,
            'h-[80vh] w-[90vw] overflow-hidden !rounded-[18px]': !isFullScreen,
          },
        )}
        style={{
          backgroundImage: `url(${bg})`,
          backgroundSize: 10,
        }}>
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <Header
          id={activeScreenshotId || ''}
          onClose={() => void closeEditor()}
          onMinimize={() =>
            void (async () => {
              if (!libraryCloseGuard.current || (await libraryCloseGuard.current())) onMinimize();
            })()
          }
          onToggleFullScreen={() => setFullScreen(flag => !flag)}
          isFullScreen={isFullScreen}
          title={title}
          onTitleChange={value => {
            librarySession.title = value;
            setTitle(value);
          }}
          onUndo={() => {
            dispatch(triggerCanvasAction('UNDO'));
          }}
          onRedo={() => {
            dispatch(triggerCanvasAction('REDO'));
          }}
          onStartOver={() => {
            dispatch(triggerCanvasAction('START_OVER'));
          }}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          onDownload={handleOnDownload}
          downloadLoading={isDownloading || isLibrarySaving}
          onCopy={handleOnCopy}
          onAiDebug={handleOnAiDebug}
          aiDebugLoading={isStartingAiDebug}
        />

        <LibrarySave
          session={librarySession}
          title={title}
          screenshots={screenshots}
          activeId={activeScreenshotId}
          renderActive={getLibraryRenderer}
          onSavingChange={setLibrarySaving}
          onBeforeCloseReady={setLibraryCloseGuard}
        />

        <main
          ref={canvasRef}
          className={cn(
            'grid h-full min-h-0 gap-4 p-4 transition-[grid-template-columns] duration-300',
            isLeftSidebarOpen ? 'grid-cols-[260px_minmax(0,1fr)]' : 'grid-cols-[1px_minmax(0,1fr)]',
          )}>
          <LeftSidebar
            activeScreenshotId={activeScreenshotId!}
            canvasHeight={canvasHeight}
            open={isLeftSidebarOpen}
            onOpenChange={handleOnOpenSidebar}
            screenshots={screenshots}
            onDelete={onDeleteScreenshot}
            onSelect={onSelectScreenshot}
          />

          <CanvasContainerView
            key={activeScreenshotId ?? 'empty'}
            screenshot={activeScreenshot!}
            onElement={handleOnElement}
            onAiRendererReady={handleAiRendererReady}
          />
        </main>

        <Footer
          tool={activeElement?.name}
          zoom={100}
          file={title}
          onZoomChange={zoom => {
            console.log('zoom', zoom);
          }}
        />
      </DialogContent>
    </Dialog>
  );
};

export default Content;
