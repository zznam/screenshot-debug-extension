import { useEffect, useMemo, useState } from 'react';

import { t } from '@extension/i18n';
import type { Screenshot } from '@extension/shared';
import { useStorage } from '@extension/shared';
import { captureSettingsStorage, debugModeStorage, themeStorage } from '@extension/storage';
import { useAppDispatch, triggerCanvasAction } from '@extension/store';
import { Dialog, DialogContent, DialogTitle, cn, toast } from '@extension/ui';

import { CanvasContainerView } from './components/annotation-view';
import { Footer, Header, LeftSidebar } from './components/annotation-view/ui';
import { defaultNavElement } from './constants';
import { useElementSize, useViewportSize } from './hooks';
import type { ActiveElement } from './models';
import { copyBase64ImageToClipboard } from './utils/base64-to-clipboard.util';
import { deleteRecords } from './utils/slice';

const SM_BREAKPOINT = 640;
const LG_BREAKPOINT = 1024;

interface ContentProps {
  idempotencyKey: string;
  activeScreenshotId: string;
  screenshots: Screenshot[];
  onClose: () => void;
  onMinimize: () => void;
  onDeleteScreenshot: (id: string) => void;
  onSelectScreenshot(id: string): void;
}

const Content = ({
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
  const [title, setTitle] = useState('Untitled report');
  const [activeElement, setActiveElement] = useState<ActiveElement>(defaultNavElement);

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
    const timestamp = Date.now();
    const screenshotName = `${location.host}-${timestamp}`.replaceAll('.', '-');

    const settings = await captureSettingsStorage.get();
    const saveDebugLog = await debugModeStorage.getDebugMode();
    const messageType = settings.exportFormat === 'zip' ? 'DOWNLOAD_ZIP' : 'DOWNLOAD_ASSETS';

    chrome.runtime.sendMessage({
      type: messageType,
      payload: {
        screenshots: screenshots.map(s => ({ src: s.src, isPrimary: s.isPrimary })),
        name: screenshotName,
        timestamp,
        host: location.host,
        url: location.href,
        title: document.title,
        saveDebugLog,
      },
    });

    try {
      await deleteRecords();
    } catch {
      //
    }
    onClose?.();
  };

  const handleOnCopy = async () => {
    try {
      if (activeScreenshot?.src) {
        await copyBase64ImageToClipboard(activeScreenshot.src);
        toast.success('Screenshot copied to clipboard!');
      }
    } catch (e) {
      toast.error('Failed to copy screenshot');
      console.error(e);
    }
  };

  const handleOnOpenSidebar = (open: boolean) => {
    setLeftSidebarOpen(open);
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={onClose} modal>
      <DialogContent
        data-testid="screenshot-editor"
        aria-describedby="Annotation View"
        onEscapeKeyDown={e => e.preventDefault()}
        onPointerDownOutside={e => e.preventDefault()}
        className={cn(
          'bg-background text-foreground grid max-w-none grid-rows-[auto_minmax(0,1fr)_auto] !gap-0 border-none bg-repeat p-0',
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
          onClose={onClose}
          onMinimize={onMinimize}
          onToggleFullScreen={() => setFullScreen(flag => !flag)}
          isFullScreen={isFullScreen}
          title={title}
          onTitleChange={setTitle}
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
          onCopy={handleOnCopy}
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
