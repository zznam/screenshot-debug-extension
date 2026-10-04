import { useCallback, useEffect, useRef, useState } from 'react';

import {
  CanvasContainerView,
  createEditorSession,
  defaultNavElement,
  EditorSessionProvider,
  Footer,
  Header,
  LeftSidebar,
  mergeScreenshot,
  copyBase64ImageToClipboard,
  encodeScreenshot,
  useEditorSession,
  useSessionAnnotations,
  useElementSize,
} from '@extension/editor';
import type { ActiveElement, EditorSession } from '@extension/editor';
import type { CaptureDocument, Screenshot } from '@extension/shared';
import { useStorage } from '@extension/shared';
import {
  captureSettingsStorage,
  getLibraryCapture,
  getLibraryAsset,
  librarySettingsStorage,
  updateLibraryScreenshots,
} from '@extension/storage';
import { Button, TooltipProvider, ToasterProvider, toast } from '@extension/ui';

interface LoadedCapture {
  capture: CaptureDocument;
  screenshots: Screenshot[];
  session: EditorSession;
}
const dataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
const thumbnailFor = async (src: string) => {
  const image = new Image();
  image.src = src;
  await image.decode();
  const scale = Math.min(1, 320 / image.naturalWidth, 200 / image.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not prepare the thumbnail.');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.7);
};

const SavedEditor = ({ loaded }: { loaded: LoadedCapture }) => {
  const { session, triggerCanvasAction } = useEditorSession();
  const annotations = useSessionAnnotations(session.annotationsStorage);
  const mode = useStorage(librarySettingsStorage);
  const [title, setTitle] = useState(loaded.capture.title);
  const [activeId, setActiveId] = useState(loaded.screenshots[0]!.id!);
  const [activeElement, setActiveElement] = useState<ActiveElement>(defaultNavElement);
  const [sidebar, setSidebar] = useState(loaded.screenshots.length > 1 && innerWidth >= 1024);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const revision = useRef(loaded.capture.revision);
  const signatureFor = (value: string, layers: typeof annotations) =>
    JSON.stringify({ title: value, objects: loaded.screenshots.map(shot => layers[shot.id!]?.objects ?? []) });
  const savedSignature = useRef(signatureFor(loaded.capture.title, annotations));
  const signature = signatureFor(title, annotations);
  const dirty = signature !== savedSignature.current;
  const latest = useRef({ title, signature, dirty });
  latest.current = { title, signature, dirty };
  const inFlight = useRef<Promise<boolean> | null>(null);
  const leaving = useRef(false);
  const { ref: workspaceRef, width, height } = useElementSize<HTMLDivElement>();
  const active = loaded.screenshots.find(shot => shot.id === activeId)!;

  const render = useCallback(async (shot: Screenshot, objects: unknown[]) => {
    const image = new Image();
    image.src = shot.src;
    await image.decode();
    return dataUrl(
      await mergeScreenshot({
        screenshot: shot,
        objects,
        parentWidth: image.naturalWidth,
        parentHeight: image.naturalHeight,
      }),
    );
  }, []);
  const save = useCallback((): Promise<boolean> => {
    if (inFlight.current) return inFlight.current;
    const snapshot = structuredClone(session.annotationsStorage.getSnapshot());
    const current = { ...latest.current };
    const operation = (async () => {
      setSaving(true);
      setError('');
      setStatus('');
      try {
        const screenshots = await Promise.all(
          loaded.screenshots.map(async shot => ({
            id: shot.id!,
            annotations: snapshot[shot.id!] ?? { objects: [] },
            preview: await render(shot, snapshot[shot.id!]?.objects ?? []),
          })),
        );
        revision.current = await updateLibraryScreenshots({
          id: loaded.capture.id,
          expectedRevision: revision.current,
          title: current.title,
          screenshots,
          thumbnail: await thumbnailFor(screenshots[0]!.preview),
        });
        savedSignature.current = current.signature;
        setStatus('Changes saved on this device.');
        return true;
      } catch (cause) {
        setError(
          cause instanceof DOMException && cause.name === 'QuotaExceededError'
            ? 'Not enough storage. Your saved capture and current edits are intact. Download your edits, free space in the library, then retry.'
            : cause instanceof Error
              ? cause.message
              : 'Could not save your edits. Download or retry before leaving.',
        );
        return false;
      } finally {
        setSaving(false);
        inFlight.current = null;
      }
    })();
    inFlight.current = operation;
    return operation;
  }, [loaded, render, session]);
  useEffect(() => {
    if (mode !== 'automatic' || !dirty || saving || error || !title.trim()) return;
    const timer = setTimeout(() => {
      void save();
    }, 800);
    return () => clearTimeout(timer);
  }, [dirty, error, mode, save, saving, signature, title]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!leaving.current && (latest.current.dirty || inFlight.current)) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);
  const close = async () => {
    if (inFlight.current && !(await inFlight.current)) return;
    if (mode === 'automatic' && latest.current.signature !== savedSignature.current && !error) {
      if (!(await save())) return;
    }
    if (
      latest.current.signature !== savedSignature.current &&
      !window.confirm('Leave without saving these edits? Your last saved version will be kept.')
    )
      return;
    leaving.current = true;
    location.href = `?capture=${encodeURIComponent(loaded.capture.id)}`;
  };
  const reload = () => {
    if (
      latest.current.signature !== savedSignature.current &&
      !window.confirm(
        'Reload the saved version and discard these unsaved edits? Download them first if you want to keep a copy.',
      )
    )
      return;
    leaving.current = true;
    location.reload();
  };
  const download = async () => {
    setExporting(true);
    try {
      const settings = await captureSettingsStorage.get();
      const src = await render(active, session.annotationsStorage.getSnapshot()[activeId]?.objects ?? []);
      const url = await encodeScreenshot(src, settings.screenshotFormat, settings.screenshotQuality);
      const link = document.createElement('a');
      link.href = url;
      link.download = `screenshot-${activeId}.${settings.screenshotFormat}`;
      link.click();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Could not download the screenshot.');
    } finally {
      setExporting(false);
    }
  };
  const copy = async () => {
    try {
      const png = render(active, session.annotationsStorage.getSnapshot()[activeId]?.objects ?? []).then(src =>
        fetch(src).then(response => response.blob()),
      );
      // Supply a promise while the click still has user activation.
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write)
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
      else await copyBase64ImageToClipboard(await dataUrl(await png));
      toast.success('Screenshot copied to clipboard!');
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Could not copy the screenshot.');
    }
  };
  return (
    <div className="saved-editor" data-testid="saved-screenshot-editor">
      <Header
        id={activeId}
        title={title}
        onTitleChange={setTitle}
        onClose={() => {
          void close();
        }}
        onUndo={() => triggerCanvasAction('UNDO')}
        onRedo={() => triggerCanvasAction('REDO')}
        onStartOver={() => triggerCanvasAction('START_OVER')}
        canvasWidth={width}
        canvasHeight={height}
        onDownload={() => {
          void download();
        }}
        downloadLoading={exporting}
        onCopy={() => {
          void copy();
        }}
      />
      <section
        aria-label="Save screenshot edits"
        className="border-border bg-card flex flex-wrap items-center gap-2 border-b px-4 py-2 text-sm">
        <Button
          size="sm"
          disabled={saving || !dirty || !title.trim()}
          onClick={() => {
            void save();
          }}>
          {saving ? 'Saving changes…' : dirty ? 'Save changes' : 'Saved'}
        </Button>
        <span className="text-muted-foreground">
          {mode === 'automatic' ? 'Edits save automatically.' : 'Save edits when you are ready.'} Original images stay
          intact.
        </span>
        <span role="status" className="text-muted-foreground">
          {status}
        </span>
        {error && (
          <div className="text-destructive flex w-full flex-wrap items-center gap-2" role="alert">
            {error}
            <Button
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() => {
                void save();
              }}>
              Retry save
            </Button>
            <Button size="sm" variant="outline" onClick={reload}>
              Reload saved version
            </Button>
            <a className="underline" href="index.html" target="_blank" rel="noreferrer">
              Free space in library
            </a>
          </div>
        )}
      </section>
      <main
        ref={workspaceRef}
        className="saved-editor-workspace"
        data-sidebar={sidebar}
        aria-label="Screenshot annotation workspace">
        <LeftSidebar
          open={sidebar}
          canvasHeight={height}
          screenshots={loaded.screenshots}
          activeScreenshotId={activeId}
          onOpenChange={setSidebar}
          onSelect={setActiveId}
        />
        <CanvasContainerView key={activeId} screenshot={active} onElement={setActiveElement} />
      </main>
      <Footer tool={activeElement?.name} file={title} zoom={100} />
    </div>
  );
};

export default function ScreenshotEditorPage({ id, theme }: { id: string; theme: 'dark' | 'light' }) {
  const [loaded, setLoaded] = useState<LoadedCapture>();
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    void (async () => {
      const capture = await getLibraryCapture(id);
      if (!capture) throw new Error('This capture no longer exists.');
      const originals = await Promise.all(capture.screenshots.map(shot => getLibraryAsset(shot.originalAssetId)));
      if (cancelled) return;
      const screenshots = originals.map((blob, index) => {
        if (!blob) throw new Error('An original screenshot is missing.');
        const src = URL.createObjectURL(blob);
        urls.push(src);
        return {
          id: capture.screenshots[index]!.id,
          src,
          isPrimary: capture.screenshots[index]!.isPrimary,
          name: `Screenshot ${index + 1}`,
          alt: `Screenshot ${index + 1}`,
        };
      });
      setLoaded({
        capture,
        screenshots,
        session: createEditorSession(Object.fromEntries(capture.screenshots.map(shot => [shot.id, shot.annotations]))),
      });
    })().catch(cause => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not open the editor.');
    });
    return () => {
      cancelled = true;
      urls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [id]);
  if (!loaded)
    return (
      <main className="library-shell library-main">
        <a href="index.html">← All captures</a>
        <p role={error ? 'alert' : 'status'}>{error || 'Opening editor…'}</p>
      </main>
    );
  return (
    <TooltipProvider>
      <ToasterProvider theme={theme} className="saved-editor-toasts" />
      <EditorSessionProvider session={loaded.session}>
        <SavedEditor loaded={loaded} />
      </EditorSessionProvider>
    </TooltipProvider>
  );
}
