import { useCallback, useEffect, useRef, useState } from 'react';

import { useStorage } from '@extension/shared';
import type { Screenshot } from '@extension/shared';
import { annotationsStorage, librarySettingsStorage } from '@extension/storage';
import { Button } from '@extension/ui';

import { prepareLibrarySession, saveScreenshotsToLibrary } from '@src/utils/library-capture.util';
import type { LibraryContext, LibrarySaveSession } from '@src/utils/library-capture.util';

interface LibrarySaveProps {
  session: LibrarySaveSession;
  title: string;
  screenshots: Screenshot[];
  activeId: string;
  renderActive: () => (() => string) | null;
  onSavingChange: (saving: boolean) => void;
  onBeforeCloseReady: (guard: (() => Promise<boolean>) | null) => void;
}

const LibrarySave = ({
  session,
  title,
  screenshots,
  activeId,
  renderActive,
  onSavingChange,
  onBeforeCloseReady,
}: LibrarySaveProps) => {
  const mode = useStorage(librarySettingsStorage);
  const annotations = useStorage(annotationsStorage);
  const [context, setContext] = useState<LibraryContext>();
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [paused, setPaused] = useState(false);
  const revision = useRef(session.revision);
  const abort = useRef<AbortController | null>(null);
  const savedSignature = useRef(session.signature);
  const latestSignature = useRef('');
  const signature = JSON.stringify({
    title,
    ids: screenshots.map(shot => shot.id),
    annotations: screenshots.map(shot => annotations?.[shot.id!]),
  });
  latestSignature.current = signature;
  const dirty = signature !== savedSignature.current;

  const prepare = useCallback(async () => {
    setError('');
    try {
      setContext(await prepareLibrarySession(session));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not prepare local saving.');
    }
  }, [session]);
  useEffect(() => {
    void prepare();
    return () => abort.current?.abort();
  }, [prepare]);
  const save = useCallback(async () => {
    if (!context || abort.current) return false;
    const controller = new AbortController();
    abort.current = controller;
    setSaving(true);
    onSavingChange(true);
    setError('');
    setStatus('');
    setProgress(0);
    setPaused(false);
    const savingSignature = latestSignature.current;
    try {
      revision.current = await saveScreenshotsToLibrary({
        context,
        revision: revision.current,
        title: title === 'Untitled report' ? context.source.title : title,
        screenshots,
        activeId,
        renderActive: renderActive(),
        signal: controller.signal,
        onProgress: setProgress,
      });
      savedSignature.current = savingSignature;
      session.signature = savingSignature;
      session.revision = revision.current;
      setStatus('Saved to your local library.');
      return true;
    } catch (cause) {
      if (controller.signal.aborted) {
        setStatus('Save cancelled. Your preview is still available.');
        setPaused(true);
      } else setError(cause instanceof Error ? cause.message : 'Save failed. Download or retry this capture.');
      return false;
    } finally {
      abort.current = null;
      setSaving(false);
      onSavingChange(false);
    }
  }, [activeId, context, onSavingChange, renderActive, screenshots, session, title]);

  useEffect(() => {
    onBeforeCloseReady(async () => {
      if (abort.current) return false;
      if (mode === 'automatic' && (error || paused) && latestSignature.current !== savedSignature.current) {
        return window.confirm(
          'Close without saving your latest changes? You can keep this preview open to download or retry.',
        );
      }
      if (mode === 'automatic' && latestSignature.current !== savedSignature.current) return save();
      return true;
    });
    return () => onBeforeCloseReady(null);
  }, [error, mode, onBeforeCloseReady, paused, save]);
  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (abort.current || (mode === 'automatic' && latestSignature.current !== savedSignature.current)) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [mode]);

  useEffect(() => {
    if (mode !== 'automatic' || !context || saving || !dirty || error || paused) return;
    const timer = setTimeout(() => void save(), 800);
    return () => clearTimeout(timer);
  }, [context, dirty, error, mode, paused, save, saving, signature]);

  const choose = async (next: 'manual' | 'automatic') => {
    try {
      await librarySettingsStorage.set(next);
    } catch {
      setError('Could not save your preference. Please retry.');
    }
  };
  return (
    <section
      aria-label="Local capture saving"
      className="border-border bg-card flex flex-wrap items-center gap-2 border-b px-4 py-2 text-sm">
      {mode === 'ask' ? (
        <>
          <span>Keep captures on this device?</span>
          <Button size="sm" variant="outline" onClick={() => void choose('manual')}>
            Save manually
          </Button>
          <Button size="sm" variant="outline" onClick={() => void choose('automatic')}>
            Save automatically
          </Button>
          <span className="text-muted-foreground text-xs">You can change this in Settings.</span>
        </>
      ) : (
        <>
          <Button size="sm" variant="secondary" disabled={!context || saving || !dirty} onClick={() => void save()}>
            {saving ? `Saving… ${progress}%` : dirty ? 'Save to library' : 'Saved'}
          </Button>
          {saving && (
            <Button size="sm" variant="outline" onClick={() => abort.current?.abort()}>
              Cancel save
            </Button>
          )}
        </>
      )}
      <Button
        size="sm"
        variant="link"
        onClick={() => void chrome.runtime.sendMessage({ type: 'OPEN_CAPTURE_LIBRARY' })}>
        Open library
      </Button>
      {error && (
        <span role="alert" className="text-destructive">
          {error}
          {!context && (
            <Button size="sm" variant="link" onClick={() => void prepare()}>
              Retry
            </Button>
          )}
          {context && (
            <Button size="sm" variant="link" onClick={() => void save()}>
              Retry save
            </Button>
          )}
        </span>
      )}
      {status && (
        <span role="status" className="text-muted-foreground text-xs">
          {status}
        </span>
      )}
    </section>
  );
};

export { LibrarySave };
