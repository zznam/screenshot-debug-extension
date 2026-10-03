import { useEffect, useRef, useState } from 'react';

import { t } from '@extension/i18n';
import { getCapturePageError, useStorage } from '@extension/shared';
import { captureStateStorage, captureTabStorage, captureStartErrorStorage } from '@extension/storage';
import { Alert, AlertDescription, AlertTitle, Button, Icon } from '@extension/ui';

import { exitScreenshotCapture, reconcileScreenshotCaptureOwner } from '@src/utils';

const captureTypes = [
  {
    name: t('area'),
    slug: 'area',
    icon: 'SquareDashed',
  },
  { name: t('viewport'), slug: 'viewport', icon: 'AppWindowMac' },
  {
    name: t('fullPage'),
    slug: 'full-page',
    icon: 'RectangleVertical',
  },
] as const;

export const CaptureScreenshotGroup = () => {
  const captureModeAndState = useStorage(captureStateStorage);
  const captureState = captureModeAndState?.mode === 'screenshot' ? captureModeAndState.state : 'idle';
  const captureTabId = useStorage(captureTabStorage);

  const [activeTab, setActiveTab] = useState({ id: null as number | null, url: '' });
  const [currentActiveTab, setCurrentActiveTab] = useState<number>();
  const [captureError, setCaptureError] = useState<string | null>(null);
  const startError = useStorage(captureStartErrorStorage);
  const [starting, setStarting] = useState(false);
  const startingRef = useRef(false);

  useEffect(() => {
    const initializeState = async () => {
      setActiveTab(prev => ({ ...prev, id: captureTabId }));

      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });

      if (tabs[0]?.url) {
        setActiveTab(prev => ({ ...prev, url: tabs[0].url! }));
        setCurrentActiveTab(tabs[0].id);
      }

      if (captureState === 'capturing') {
        try {
          await reconcileScreenshotCaptureOwner(captureTabId);
        } catch (error) {
          setCaptureError(error instanceof Error ? error.message : String(error));
        }
      }
    };

    const handleEscapeKey = async (event: KeyboardEvent) => {
      if (event.key === 'Escape' && captureState === 'capturing') {
        try {
          await exitScreenshotCapture(captureTabId);
        } catch (error) {
          setCaptureError(error instanceof Error ? error.message : String(error));
        }
      }
    };

    void initializeState().catch(error => setCaptureError(error instanceof Error ? error.message : String(error)));
    window.addEventListener('keydown', handleEscapeKey);

    return () => window.removeEventListener('keydown', handleEscapeKey);
  }, [captureState, captureTabId]);

  const handleCaptureScreenshot = async (type: 'full-page' | 'viewport' | 'area') => {
    if (startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    setCaptureError(null);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (typeof tab?.id !== 'number') throw new Error('Could not find the active page.');
      const unavailable = getCapturePageError(tab.url);
      if (unavailable) throw new Error(unavailable);
      const response = (await chrome.runtime.sendMessage({
        type: 'START_SCREENSHOT_CAPTURE',
        tabId: tab.id,
        captureType: type,
      })) as { ok?: boolean; error?: string; message?: string };
      if (!response?.ok) throw new Error(response?.error ?? response?.message ?? 'Unable to start screenshot capture.');
      window.close();
    } catch (error) {
      setCaptureError(error instanceof Error ? error.message : String(error));
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  };

  const exitMissingOwner = async (ownerTabId: number | null) => {
    try {
      await exitScreenshotCapture(ownerTabId);
      setCaptureError('The original capture tab is no longer open. Screenshot capture was exited.');
    } catch (error) {
      setCaptureError(error instanceof Error ? error.message : String(error));
    }
  };

  const handleGoToActiveTab = async () => {
    if (!activeTab.id) {
      await exitMissingOwner(null);
      return;
    }

    try {
      await chrome.tabs.get(activeTab.id);
    } catch {
      await exitMissingOwner(activeTab.id);
      return;
    }

    await chrome.tabs.update(activeTab.id, { active: true });
    window.close();
  };

  const handleOnDiscard = async () => {
    setCaptureError(null);

    try {
      await exitScreenshotCapture(activeTab.id);
    } catch (error) {
      setCaptureError(error instanceof Error ? error.message : String(error));
    }
  };

  const unavailable = getCapturePageError(activeTab.url);

  if (captureState === 'capturing' && currentActiveTab !== activeTab.id) {
    return (
      <>
        <Alert className="text-center">
          <AlertTitle className="text-[14px]">{t('capturingInProgress')}</AlertTitle>
          <AlertDescription className="text-[12px]">{t('capturingInAnotherTab')}</AlertDescription>
        </Alert>

        <div className="mt-4 flex gap-x-2">
          <Button variant="secondary" type="button" size="sm" className="w-full" onClick={handleOnDiscard}>
            {t('discard')}
          </Button>
          <Button type="button" size="sm" className="w-full" onClick={handleGoToActiveTab}>
            {t('openActiveTab')}
          </Button>
        </div>
      </>
    );
  }

  if (captureState === 'capturing' && currentActiveTab === activeTab.id) {
    return (
      <div className="border-muted grid w-full gap-4 rounded-xl border bg-slate-100/20 p-2">
        <button
          className="hover:bg-accent flex w-full items-center justify-center rounded-md border border-transparent py-4"
          onClick={handleOnDiscard}>
          <Icon name="X" size={20} strokeWidth={1.5} className="mr-1" />
          <span>{t('exitCaptureScreenshot')}</span>
        </button>
      </div>
    );
  }

  return (
    <>
      {unavailable && (
        <Alert className="mb-3 text-center">
          <AlertDescription className="text-[12px]">
            {t('navigateToWebsite')} {unavailable}
          </AlertDescription>
        </Alert>
      )}
      {(captureError || startError) && (
        <Alert variant="destructive" className="mb-3">
          <AlertDescription className="text-[12px]">{captureError || startError}</AlertDescription>
        </Alert>
      )}
      <div
        role="group"
        aria-label="Screenshot capture modes"
        className="border-muted grid w-full grid-cols-3 gap-2 rounded-xl border bg-slate-100/20 p-2">
        {captureTypes.map(type => (
          <Button
            key={type.slug}
            id={type.slug}
            variant="ghost"
            disabled={starting || Boolean(unavailable)}
            onClick={() => void handleCaptureScreenshot(type.slug)}
            className="h-auto flex-col gap-3 py-4">
            <Icon name={type.icon} className="size-5" strokeWidth={type.slug === 'area' ? 2 : 1.5} />
            <span className="text-nowrap text-[11px]">{type.name}</span>
          </Button>
        ))}
      </div>
      {starting && (
        <p role="status" className="text-muted-foreground mt-2 text-center text-xs">
          Starting capture…
        </p>
      )}

      {activeTab.id !== currentActiveTab && captureState === 'capturing' && (
        <Button type="button" variant="link" size="sm" className="w-full" onClick={handleGoToActiveTab}>
          {t('openActiveTab')}
        </Button>
      )}
    </>
  );
};
