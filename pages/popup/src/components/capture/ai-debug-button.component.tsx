import { useState } from 'react';

import { AI_DEBUG } from '@extension/shared';
import type { AiDebugResponse } from '@extension/shared';
import { Alert, AlertDescription, Button, Icon } from '@extension/ui';

export const AiDebugButton = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const startAiDebug = async () => {
    setLoading(true);
    setError('');
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (typeof tab?.id !== 'number') throw new Error('Could not find the active page.');
      const response = (await chrome.runtime.sendMessage({ type: AI_DEBUG.START, tabId: tab.id })) as AiDebugResponse;
      if (response.status === 'error') throw new Error(response.message);
      window.close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not start AI Debug.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-3">
      <Button className="w-full gap-2" onClick={startAiDebug} loading={loading} disabled={loading}>
        <Icon name="Sparkles" className="size-4" />
        AI Debug
      </Button>
      <p className="text-muted-foreground mt-2 text-center text-[11px]">
        Analyze a redacted screenshot and diagnostics in a persistent tab.
      </p>
      {error && (
        <Alert variant="destructive" className="mt-3">
          <AlertDescription className="text-[12px]">{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
};
