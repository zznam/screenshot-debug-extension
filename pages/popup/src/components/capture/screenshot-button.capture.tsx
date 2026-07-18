import { useCallback, useEffect, useMemo, useState } from 'react';

import { t } from '@extension/i18n';
import { useStorage } from '@extension/shared';
import { captureStateStorage, captureTabStorage, pendingReloadTabsStorage } from '@extension/storage';
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
  const captureState = useStorage(captureStateStorage);
  const captureTabId = useStorage(captureTabStorage);
  const pendingReloadTabIds = useStorage(pendingReloadTabsStorage);

  const [activeTab, setActiveTab] = useState({ id: null as number | null, url: '' });
  const [currentActiveTab, setCurrentActiveTab] = useState<number>();

  const isCaptureActive = useMemo(() => ['capturing', 'unsaved'].includes(captureState), [captureState]);

  useEffect(() => {
    const initializeState = async () => {
      setActiveTab(prev => ({ ...prev, id: captureTabId }));

      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });

      if (tabs[0]?.url) {
        setActiveTab(prev => ({ ...prev, url: tabs[0].url! }));
        setCurrentActiveTab(tabs[0].id);
      }
    };

    const handleEscapeKey = async (event: KeyboardEvent) => {
      if (event.key === 'Escape' && captureState === 'capturing') {
        await updateCaptureState('idle');
        await updateActiveTab(null);
      }
    };

    initializeState();
    window.addEventListener('keydown', handleEscapeKey);

    return () => window.removeEventListener('keydown', handleEscapeKey);
  }, [captureState, captureTabId]);

  const updateCaptureState = useCallback(async (state: any) => {
    await captureStateStorage.setCaptureState(state);
  }, []);

  const updateActiveTab = useCallback(async (tabId: number | null) => {
    await captureTabStorage.setCaptureTabId(tabId);
    setActiveTab(prev => ({ ...prev, id: tabId }));
  }, []);

  const handleCaptureScreenshot = async (type?: 'full-page' | 'viewport' | 'area') => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tabs[0]?.id && type) {
      await updateCaptureState('capturing');
      await updateActiveTab(tabs[0].id);

      chrome.tabs.sendMessage(
        tabs[0].id,
        {
          action: 'START_SCREENSHOT',
          payload: { type },
        },
        response => {
          if (chrome.runtime.lastError) {
            console.error('Error starting capture:', type, chrome.runtime.lastError.message);
          } else {
            console.log('Capture started:', type, response);
          }
        },
      );
    }

    window.close();
  };

  const handleGoToActiveTab = async () => {
    if (activeTab.id) {
      await chrome.tabs.update(activeTab.id, { active: true });
      window.close();
    }
  };

  const handleOnRefreshPendingTab = async () => {
    if (currentActiveTab) {
      await chrome.tabs.reload(currentActiveTab);
      await pendingReloadTabsStorage.remove(currentActiveTab);
    }
  };

  const handleOnDiscard = async (activeTabId: number) => {
    await updateCaptureState('idle');
    await updateActiveTab(null);

    chrome.tabs.sendMessage(activeTabId, { action: 'CLOSE_MODAL' }, response => {
      if (chrome.runtime.lastError) {
        console.error('Error stopping unsaved:', chrome.runtime.lastError.message);
      } else {
        console.log('Unsaved closed:', response);
      }
    });
  };

  const isInternalPage = activeTab.url.startsWith('about:') || activeTab.url.startsWith('chrome:');
  const showExitCapture = isCaptureActive && currentActiveTab !== activeTab.id;

  if (currentActiveTab && pendingReloadTabIds?.includes(currentActiveTab)) {
    return (
      <>
        <Alert className="text-center">
          <AlertDescription className="text-[12px]">
            {t('quickRefresh')} <br />
            {t('readyToGo')}
          </AlertDescription>
        </Alert>

        <div className="mt-4 flex gap-x-2">
          <Button type="button" size="sm" className="w-full" onClick={handleOnRefreshPendingTab}>
            {t('refreshPage')}
          </Button>
        </div>
      </>
    );
  }

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
          <Button
            variant="secondary"
            type="button"
            size="sm"
            className="w-full"
            onClick={() => activeTab?.id && handleOnDiscard(activeTab.id)}>
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
          onClick={() => activeTab?.id && handleOnDiscard(activeTab.id)}>
          <Icon name="X" size={20} strokeWidth={1.5} className="mr-1" />
          <span>{t('exitCaptureScreenshot')}</span>
        </button>
      </div>
    );
  }

  return (
    <>
      <RadioGroup
        className={cn('border-muted grid w-full gap-4 rounded-xl border bg-slate-100/20 p-2', {
          'grid-cols-3': !showExitCapture,
        })}>
        {showExitCapture ? (
          <button
            className="hover:bg-accent flex w-full items-center justify-center rounded-md border border-transparent py-4"
            onClick={() => activeTab?.id && handleOnDiscard(activeTab.id)}>
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
