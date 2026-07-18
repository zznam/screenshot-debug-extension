import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AI_DEBUG, useStorage } from '@extension/shared';
import type { AiDebugMessage, AiDebugResponse, AiDebugSession, AiDebugSessionSummary } from '@extension/shared';
import { themeStorage } from '@extension/storage';
import { Button, Input, Textarea, cn } from '@extension/ui';

import { checkHelper, HELPER_URL, requestAiResponse, savePairingToken } from './helper-client';
import type { HelperState } from './helper-client';

const sessionId = new URLSearchParams(window.location.search).get('session') ?? '';
const initialPrompt =
  'Analyze this page capture and its diagnostics. Identify the most likely root cause, cite the supporting evidence, and recommend concrete fixes and verification steps.';

const sendRuntime = async (message: unknown): Promise<AiDebugResponse> => chrome.runtime.sendMessage(message);

const helperLabel: Record<HelperState, string> = {
  checking: 'Checking helper…',
  offline: 'Helper is not running',
  'missing-key': 'OPENAI_API_KEY is not set',
  unpaired: 'Pair the extension',
  ready: 'Helper connected',
};

export const AiDebugPage = () => {
  const theme = useStorage(themeStorage);
  const [session, setSession] = useState<AiDebugSession | null>(null);
  const [history, setHistory] = useState<AiDebugSessionSummary[]>([]);
  const [helperState, setHelperState] = useState<HelperState>('checking');
  const [pairingToken, setPairingToken] = useState('');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const autoStarted = useRef(false);

  const refreshSession = useCallback(async () => {
    const [sessionResponse, historyResponse] = await Promise.all([
      sessionId ? sendRuntime({ type: AI_DEBUG.GET_SESSION, sessionId }) : Promise.resolve(null),
      sendRuntime({ type: AI_DEBUG.LIST_SESSIONS }),
    ]);
    if (sessionResponse?.status === 'success') setSession(sessionResponse.session ?? null);
    else if (sessionResponse?.status === 'error') setError(sessionResponse.message);
    if (historyResponse.status === 'success') setHistory(historyResponse.sessions ?? []);
  }, []);

  const refreshHelper = useCallback(async () => {
    setHelperState('checking');
    const result = await checkHelper();
    setHelperState(result.state);
    return result.state;
  }, []);

  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
  }, [theme]);

  useEffect(() => {
    void Promise.all([refreshSession(), refreshHelper()]);
  }, [refreshHelper, refreshSession]);

  const persistMessage = useCallback(async (message: AiDebugMessage, model?: string) => {
    const response = await sendRuntime({ type: AI_DEBUG.SAVE_MESSAGE, sessionId, message, model });
    if (response.status === 'error') throw new Error(response.message);
    if (!response.session) throw new Error('Could not save message.');
    setSession(response.session);
    return response.session;
  }, []);

  const submit = useCallback(
    async (text?: string) => {
      if (!session || sending || helperState !== 'ready') return;
      if (!session.context.screenshotDataUrl) {
        setError(session.error || 'A screenshot is required. Return to the source tab and click AI Debug again.');
        return;
      }

      setSending(true);
      setError('');
      try {
        let current = session;
        const last = current.messages.at(-1);
        if (text || last?.role !== 'user' || current.status !== 'prepared') {
          const userMessage: AiDebugMessage = {
            id: crypto.randomUUID(),
            role: 'user',
            content: text || initialPrompt,
            createdAt: Date.now(),
          };
          current = await persistMessage(userMessage);
        }
        const result = await requestAiResponse(current);
        await persistMessage(result.message, result.model);
        setDraft('');
        await refreshSession();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'AI Debug failed.');
      } finally {
        setSending(false);
      }
    },
    [helperState, persistMessage, refreshSession, sending, session],
  );

  useEffect(() => {
    if (autoStarted.current || helperState !== 'ready' || session?.status !== 'prepared') return;
    autoStarted.current = true;
    void submit();
  }, [helperState, session?.status, submit]);

  const pair = async () => {
    await savePairingToken(pairingToken);
    const state = await refreshHelper();
    if (state === 'ready') setError('');
  };

  const removeSession = async () => {
    if (!session) return;
    await sendRuntime({ type: AI_DEBUG.DELETE_SESSION, sessionId: session.id });
    window.location.href = chrome.runtime.getURL('ai-debug/index.html');
  };

  const domain = useMemo(() => {
    try {
      return session ? new URL(session.context.sourceUrl).hostname : '';
    } catch {
      return '';
    }
  }, [session]);

  return (
    <main className="bg-background text-foreground flex min-h-screen">
      <aside className="border-border bg-card hidden w-72 shrink-0 border-r p-4 lg:block">
        <div className="mb-6 flex items-center gap-3">
          <img
            src={chrome.runtime.getURL('logo.png')}
            className="size-10 object-contain"
            alt="Screenshot & Debug nón lá logo"
          />
          <div>
            <h1 className="font-semibold">AI Debug</h1>
            <p className="text-muted-foreground text-xs">Persistent local sessions</p>
          </div>
        </div>
        <div className="space-y-2">
          {history.map(item => (
            <a
              key={item.id}
              href={chrome.runtime.getURL(`ai-debug/index.html?session=${item.id}`)}
              className={cn('hover:bg-accent block rounded-lg p-3 text-sm', item.id === sessionId && 'bg-accent')}>
              <div className="truncate font-medium">{item.sourceTitle || 'Untitled page'}</div>
              <div className="text-muted-foreground mt-1 truncate text-xs">{item.sourceUrl}</div>
            </a>
          ))}
          {!history.length && <p className="text-muted-foreground text-sm">No AI sessions yet.</p>}
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="border-border bg-card flex min-h-16 items-center justify-between border-b px-5 py-3">
          <div className="min-w-0">
            <h2 className="truncate font-semibold">{session?.context.sourceTitle || 'AI Debug setup'}</h2>
            <p className="text-muted-foreground truncate text-xs">{domain || HELPER_URL}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="border-border bg-muted rounded-full border px-3 py-1 text-xs">
              {helperLabel[helperState]}
            </span>
            {session && (
              <Button variant="outline" size="sm" onClick={removeSession}>
                Clear session
              </Button>
            )}
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col p-5">
          {helperState !== 'ready' ? (
            <section className="border-border bg-card mx-auto mt-12 w-full max-w-2xl rounded-2xl border p-6 shadow-sm">
              <h2 className="text-xl font-semibold">Connect the local AI helper</h2>
              <p className="text-muted-foreground mt-2 text-sm">
                Your prepared screenshot and diagnostics stay in this extension until the helper is ready.
              </p>
              <ol className="mt-6 space-y-4 text-sm">
                <li>
                  <strong>1.</strong> Set <code className="bg-muted rounded px-2 py-1">OPENAI_API_KEY</code> in your
                  terminal.
                </li>
                <li>
                  <strong>2.</strong> Run <code className="bg-muted rounded px-2 py-1">pnpm ai:helper</code> from the
                  repository.
                </li>
                <li>
                  <strong>3.</strong> Paste the pairing token printed by the helper.
                </li>
              </ol>
              <div className="mt-6 flex gap-2">
                <Input
                  aria-label="Pairing token"
                  type="password"
                  value={pairingToken}
                  onChange={event => setPairingToken(event.target.value)}
                  placeholder="Pairing token"
                />
                <Button onClick={pair} disabled={!pairingToken.trim()}>
                  Pair
                </Button>
                <Button variant="outline" onClick={refreshHelper}>
                  Retry
                </Button>
              </div>
            </section>
          ) : (
            <>
              {session?.context.screenshotDataUrl && (
                <details className="border-border bg-card mb-4 rounded-xl border p-3">
                  <summary className="cursor-pointer text-sm font-medium">
                    Debug context · {session.context.records.length} records
                    {session.context.recordsTruncated ? ' (truncated)' : ''}
                  </summary>
                  <img
                    src={session.context.screenshotDataUrl}
                    alt="Captured source page"
                    className="border-border mt-3 max-h-72 rounded-lg border object-contain"
                  />
                </details>
              )}

              <div className="flex-1 space-y-4" aria-live="polite">
                {session?.messages.map(message => (
                  <article
                    key={message.id}
                    className={cn(
                      'max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6',
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground ml-auto'
                        : 'bg-card border-border border',
                    )}>
                    {message.content}
                  </article>
                ))}
                {sending && <p className="text-muted-foreground text-sm">Analyzing the capture…</p>}
                {!session && (
                  <p className="text-muted-foreground mt-12 text-center">Open the popup and click AI Debug.</p>
                )}
              </div>

              {error && (
                <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300">
                  {error}
                </div>
              )}

              {session && (
                <form
                  className="border-border bg-card mt-4 rounded-2xl border p-3 shadow-sm"
                  onSubmit={event => {
                    event.preventDefault();
                    if (draft.trim()) void submit(draft.trim());
                  }}>
                  <Textarea
                    value={draft}
                    onChange={event => setDraft(event.target.value)}
                    placeholder="Ask a follow-up about this bug…"
                    disabled={sending}
                  />
                  <div className="mt-2 flex justify-end">
                    <Button type="submit" disabled={!draft.trim() || sending} loading={sending}>
                      Send
                    </Button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
};
