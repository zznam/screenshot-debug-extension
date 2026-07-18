import { useEffect, useMemo, useState } from 'react';

import { t } from '@extension/i18n';
import { useStorage } from '@extension/shared';
import { captureStateStorage, captureTabStorage } from '@extension/storage';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  cn,
  Icon,
  Label,
  RadioGroup,
  RadioGroupItem,
} from '@extension/ui';

import {
  beginScreenshotCapture,
  exitScreenshotCapture,
  reconcileScreenshotCaptureOwner,
  sendMessageToTab,
} from '@src/utils';

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
];

export const CaptureScreenshotGroup = () => {
  const captureModeAndState = useStorage(captureStateStorage);
  const captureState = captureModeAndState?.mode === 'screenshot' ? captureModeAndState.state : 'idle';
  const captureTabId = useStorage(captureTabStorage);

  const [activeTab, setActiveTab] = useState({ id: null as number | null, url: '' });
  const [currentActiveTab, setCurrentActiveTab] = useState<number>();
  const [captureError, setCaptureError] = useState<string | null>(null);

  const isCaptureActive = useMemo(() => ['capturing', 'unsaved'].includes(captureState), [captureState]);

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

    initializeState();
    window.addEventListener('keydown', handleEscapeKey);

    return () => window.removeEventListener('keydown', handleEscapeKey);
  }, [captureState, captureTabId]);

  const handleCaptureScreenshot = async (type?: 'full-page' | 'viewport' | 'area') => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tabs[0]?.id && type) {
      setCaptureError(null);
      await beginScreenshotCapture(tabs[0].id);
      setActiveTab(prev => ({ ...prev, id: tabs[0].id! }));

      try {
        const response = await sendMessageToTab<{ ok?: boolean; error?: string }>(tabs[0].id, {
          action: 'START_SCREENSHOT',
          payload: { type },
        });

        if (!response?.ok) throw new Error(response?.error ?? 'Unable to start screenshot capture.');
        window.close();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Error starting capture:', type, error);
        setCaptureError(message);
        try {
          await exitScreenshotCapture(tabs[0].id);
        } catch (cleanupError) {
          setCaptureError(cleanupError instanceof Error ? cleanupError.message : String(cleanupError));
        }
        setActiveTab(prev => ({ ...prev, id: null }));
      }
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

  const isInternalPage = activeTab.url.startsWith('about:') || activeTab.url.startsWith('chrome:');
  const showExitCapture = isCaptureActive && currentActiveTab !== activeTab.id;

  if (isInternalPage && captureState !== 'unsaved' && currentActiveTab !== activeTab.id) {
    return (
      <Alert className="text-center">
        <AlertDescription className="text-[12px]">{t('navigateToWebsite')}</AlertDescription>
      </Alert>
    );
  }

  if (captureState === 'unsaved' && currentActiveTab !== activeTab.id) {
    return (
      <>
        <Alert className="text-center">
          <AlertTitle className="text-[14px]">{t('saveOrDiscardChanges')}</AlertTitle>
          <AlertDescription className="text-[12px]">
            {t('unsavedChanges')} <br /> {t('inAnotherTab')}
          </AlertDescription>
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

  if (captureState === 'unsaved' && currentActiveTab === activeTab.id) {
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
      {captureError && (
        <Alert variant="destructive" className="mb-3">
          <AlertDescription className="text-[12px]">{captureError}</AlertDescription>
        </Alert>
      )}
      <RadioGroup
        className={cn('border-muted grid w-full gap-4 rounded-xl border bg-slate-100/20 p-2', {
          'grid-cols-3': !showExitCapture,
        })}>
        {showExitCapture ? (
          <button
            className="hover:bg-accent flex w-full items-center justify-center rounded-md border border-transparent py-4"
            onClick={handleOnDiscard}>
            <Icon name="X" size={20} strokeWidth={1.5} className="mr-1" />
            <span>{t('exitCaptureScreenshot')}</span>
          </button>
        ) : (
          <>
            {captureTypes.map(type => (
              <div key={type.slug}>
                <RadioGroupItem
                  value={type.slug}
                  id={type.slug}
                  className="peer sr-only"
                  onClick={() => handleCaptureScreenshot(type.slug as 'area' | 'viewport' | 'full-page')}
                />
                <Label
                  htmlFor={type.slug}
                  className={cn(
                    'hover:bg-accent hover:text-accent-foreground flex flex-col items-center justify-between rounded-md border border-transparent py-3 hover:cursor-pointer hover:border-slate-200 dark:border-0',
                  )}>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <Icon name={type.icon as any} className="mb-3 size-5" strokeWidth={type.slug === 'area' ? 2 : 1.5} />
                  <span className="text-nowrap text-[11px]">{type.name}</span>
                </Label>
              </div>
            ))}
          </>
        )}
      </RadioGroup>

      {activeTab.id !== currentActiveTab && ['capturing', 'unsaved'].includes(captureState) && (
        <Button type="button" variant="link" size="sm" className="w-full" onClick={handleGoToActiveTab}>
          {t('openActiveTab')}
        </Button>
      )}
    </>
  );
};
