import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AI_DEBUG, useStorage, useUnsavedChanges } from '@extension/shared';
import type { AiDebugMessage, AiDebugResponse, AiDebugSession, AiDebugSessionSummary } from '@extension/shared';
import { themeStorage } from '@extension/storage';
import { Button, Input, Textarea } from '@extension/ui';

import { checkHelper, HELPER_URL, HelperRequestError, requestAiResponse, savePairingToken } from './helper-client';
import type { HelperState } from './helper-client';
import { SessionExportPanel } from './session-export-panel';

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
  const [status, setStatus] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pairing, setPairing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyQuery, setHistoryQuery] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const autoStarted = useRef(false);
  const request = useRef<AbortController | null>(null);
  const pairLock = useRef(false);
  const deleteLock = useRef(false);
  const allowNavigation = useUnsavedChanges(Boolean(draft.trim()) || sending);

  const refreshSession = useCallback(async () => {
    try {
      const [sessionResponse, historyResponse] = await Promise.all([
        sessionId ? sendRuntime({ type: AI_DEBUG.GET_SESSION, sessionId }) : Promise.resolve(null),
        sendRuntime({ type: AI_DEBUG.LIST_SESSIONS }),
      ]);
      if (sessionResponse?.status === 'error') throw new Error(sessionResponse.message);
      if (historyResponse.status === 'error') throw new Error(historyResponse.message);
      setSession(sessionResponse?.session ?? null);
      setHistory(historyResponse.sessions ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load saved sessions. Try reloading this page.');
    } finally {
      setLoading(false);
    }
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
    void refreshSession();
    void refreshHelper();
    return () => request.current?.abort();
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
      if (!session || request.current || deleteLock.current || helperState !== 'ready') return;
      if (!session.context.screenshotDataUrl) {
        setError(session.error || 'A screenshot is required. Return to the source tab and click AI Debug again.');
        return;
      }
      const controller = new AbortController();
      request.current = controller;
      setSending(true);
      setError('');
      setStatus('');
      setConfirmDelete(false);
      setExportOpen(false);
      try {
        let current = session;
        // A retry reuses the saved question; it never appends another copy.
        if (text || current.messages.at(-1)?.role !== 'user') {
          current = await persistMessage({
            id: crypto.randomUUID(),
            role: 'user',
            content: text || initialPrompt,
            createdAt: Date.now(),
          });
          if (text) setDraft('');
        }
        controller.signal.throwIfAborted();
        const result = await requestAiResponse(current, controller.signal);
        controller.signal.throwIfAborted();
        await persistMessage(result.message, result.model);
        await refreshSession();
      } catch (cause) {
        if (cause instanceof HelperRequestError && cause.code === 'PAIRING_REQUIRED') setHelperState('unpaired');
        if (cause instanceof HelperRequestError && cause.code === 'MISSING_API_KEY') setHelperState('missing-key');
        if (controller.signal.aborted) setStatus('Analysis stopped. Your saved question is ready to retry.');
        else setError(cause instanceof Error ? cause.message : 'AI Debug failed. Retry your saved question.');
      } finally {
        request.current = null;
        setSending(false);
      }
    },
    [helperState, persistMessage, refreshSession, session],
  );

  useEffect(() => {
    if (autoStarted.current || helperState !== 'ready' || session?.status !== 'prepared') return;
    autoStarted.current = true;
    // Existing unanswered questions require an explicit retry after reopening.
    if (session.messages.at(-1)?.role !== 'user') void submit();
  }, [helperState, session, submit]);

  const pair = async () => {
    if (pairLock.current) return;
    pairLock.current = true;
    setPairing(true);
    setError('');
    try {
      await savePairingToken(pairingToken);
      setPairingToken('');
      await refreshHelper();
    } catch {
      setError('Could not save the pairing token. Please try again.');
    } finally {
      pairLock.current = false;
      setPairing(false);
    }
  };

  const removeSession = async () => {
    if (!session || request.current || deleteLock.current) return;
    deleteLock.current = true;
    setDeleting(true);
    setError('');
    try {
      const response = await sendRuntime({ type: AI_DEBUG.DELETE_SESSION, sessionId: session.id });
      if (response.status === 'error') throw new Error(response.message);
      allowNavigation();
      window.location.href = chrome.runtime.getURL('ai-debug/index.html');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete the session. Please try again.');
      deleteLock.current = false;
      setDeleting(false);
    }
  };
  const domain = useMemo(() => {
    try {
      return session ? new URL(session.context.sourceUrl).hostname : '';
    } catch {
      return '';
    }
  }, [session]);
  const filteredHistory = history.filter(item =>
    `${item.sourceTitle} ${item.sourceUrl}`.toLocaleLowerCase().includes(historyQuery.trim().toLocaleLowerCase()),
  );
  const pendingQuestion = session?.messages.at(-1)?.role === 'user';

  return (
    <div className="ai-shell bg-background text-foreground">
      <a href="#conversation" className="ai-skip">
        Skip to conversation
      </a>
      <aside id="session-history" className="ai-history" data-open={historyOpen} aria-label="Saved sessions">
        <a className="ai-brand" href={chrome.runtime.getURL('ai-debug/index.html')}>
          <img src={chrome.runtime.getURL('logo.png')} alt="" width="36" height="36" />
          <span>
            AI Debug<small>Saved on this device</small>
          </span>
        </a>
        <label htmlFor="session-search">Find a session</label>
        <Input
          id="session-search"
          type="search"
          placeholder="Title or website…"
          value={historyQuery}
          onChange={event => setHistoryQuery(event.target.value)}
        />
        <nav aria-label="Session history">
          {filteredHistory.map(item => (
            <a
              key={item.id}
              href={chrome.runtime.getURL(`ai-debug/index.html?session=${encodeURIComponent(item.id)}`)}
              aria-current={item.id === sessionId ? 'page' : undefined}>
              <strong>{item.sourceTitle || 'Untitled page'}</strong>
              <span>{item.sourceUrl}</span>
              <small>
                {new Date(item.updatedAt).toLocaleDateString()} · {item.messageCount} messages
              </small>
            </a>
          ))}
          <p className="ai-muted" role="status">
            {loading
              ? 'Loading sessions…'
              : !filteredHistory.length
                ? history.length
                  ? 'No matching sessions.'
                  : 'No AI sessions yet.'
                : `${filteredHistory.length} saved sessions`}
          </p>
        </nav>
        <a className="ai-library-link" href={chrome.runtime.getURL('library/index.html')}>
          Open capture library →
        </a>
      </aside>
      <section className="ai-workspace">
        <header className="ai-header">
          <div className="ai-heading">
            <Button
              className="ai-history-toggle"
              variant="outline"
              size="sm"
              aria-expanded={historyOpen}
              aria-controls="session-history"
              onClick={() => setHistoryOpen(value => !value)}>
              Sessions
            </Button>
            <div>
              <h1>{session?.context.sourceTitle || 'AI Debug'}</h1>
              <p className="ai-muted">{domain || 'Your debugging workspace'}</p>
            </div>
          </div>
          <div className="ai-actions">
            <span className="ai-helper-state" data-ready={helperState === 'ready'} role="status">
              {helperLabel[helperState]}
            </span>
            {session && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={sending || deleting}
                  aria-expanded={exportOpen}
                  aria-controls="session-export"
                  onClick={() => setExportOpen(value => !value)}>
                  Export session
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={sending || deleting}
                  aria-expanded={confirmDelete}
                  onClick={() => setConfirmDelete(value => !value)}>
                  Clear session
                </Button>
              </>
            )}
          </div>
        </header>
        <main id="conversation" className="ai-main" tabIndex={-1}>
          {error && (
            <div className="ai-error" role="alert">
              {error}
            </div>
          )}
          {confirmDelete && (
            <section className="ai-panel" aria-label="Confirm session deletion">
              <h2>Delete this saved conversation?</h2>
              <p>This removes its messages and captured context from this device.</p>
              <div className="ai-actions">
                <Button variant="destructive" disabled={deleting} onClick={() => void removeSession()}>
                  Delete permanently
                </Button>
                <Button variant="outline" disabled={deleting} onClick={() => setConfirmDelete(false)}>
                  Keep session
                </Button>
              </div>
            </section>
          )}
          {exportOpen && session && (
            <div id="session-export">
              <SessionExportPanel session={session} />
            </div>
          )}
          {helperState !== 'ready' && (
            <section className="ai-panel" aria-labelledby="helper-title">
              <h2 id="helper-title">Connect the local AI helper</h2>
              <p className="ai-muted">
                Your saved conversations are available below. Connect the helper to ask another question.
              </p>
              <details open={!session?.messages.length}>
                <summary>Helper setup</summary>
                <ol className="ai-setup-steps">
                  <li>
                    Set <code>OPENAI_API_KEY</code> in your terminal.
                  </li>
                  <li>
                    Run <code>pnpm ai:helper</code> from the repository.
                  </li>
                  <li>Paste the pairing token printed by the helper.</li>
                </ol>
                <p className="ai-muted">Helper address: {HELPER_URL}</p>
              </details>
              <form
                className="ai-pair-form"
                onSubmit={event => {
                  event.preventDefault();
                  if (pairingToken.trim()) void pair();
                }}>
                <Input
                  aria-label="Pairing token"
                  type="password"
                  autoComplete="off"
                  value={pairingToken}
                  onChange={event => setPairingToken(event.target.value)}
                  placeholder="Pairing token"
                />
                <Button type="submit" disabled={!pairingToken.trim() || pairing}>
                  Pair
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={helperState === 'checking' || pairing}
                  onClick={() => void refreshHelper()}>
                  Retry
                </Button>
              </form>
            </section>
          )}
          {loading && <p role="status">Opening saved conversation…</p>}
          {session?.context.screenshotDataUrl && (
            <details className="ai-panel ai-context">
              <summary>
                Debug context · {session.context.records.length} records
                {session.context.recordsTruncated ? ' (truncated)' : ''}
              </summary>
              <img src={session.context.screenshotDataUrl} alt="Captured source page" />
              <p className="ai-muted">
                Captured {new Date(session.context.capturedAt).toLocaleString()}. New questions send this screenshot and
                diagnostics through your local AI helper.
              </p>
            </details>
          )}
          <section className="ai-messages" aria-label="Conversation">
            {session?.messages.map(message => (
              <article
                key={message.id}
                className="ai-message"
                data-role={message.role}
                aria-label={message.role === 'user' ? 'Your message' : 'AI response'}>
                <span className="ai-speaker">{message.role === 'user' ? 'You' : 'AI assistant'}</span>
                <p>{message.content}</p>
              </article>
            ))}
          </section>
          <div role="status" className="ai-muted ai-progress">
            {sending ? 'Analyzing the capture…' : status}
          </div>
          {sending && (
            <Button variant="outline" onClick={() => request.current?.abort()}>
              Stop analysis
            </Button>
          )}
          {!sending && pendingQuestion && (
            <Button variant="outline" disabled={helperState !== 'ready' || deleting} onClick={() => void submit()}>
              Retry saved question
            </Button>
          )}
          {!loading && !session && (
            <section className="ai-empty">
              <h2>Start with a page worth investigating</h2>
              <p>Open the extension on a website and choose AI Debug. Your saved sessions stay available here.</p>
            </section>
          )}
          {session && (
            <form
              className="ai-panel ai-composer"
              onSubmit={event => {
                event.preventDefault();
                if (draft.trim()) void submit(draft.trim());
              }}>
              <label htmlFor="follow-up">Ask a follow-up</label>
              <Textarea
                id="follow-up"
                value={draft}
                onChange={event => setDraft(event.target.value)}
                placeholder="What should I investigate next?"
                disabled={sending || deleting}
              />
              <div className="ai-composer-footer">
                <span className="ai-muted">
                  {helperState === 'ready'
                    ? 'Uses the captured page context above.'
                    : 'Connect the helper to send. You can keep drafting.'}
                </span>
                <Button type="submit" disabled={!draft.trim() || sending || deleting || helperState !== 'ready'}>
                  Send
                </Button>
              </div>
            </form>
          )}
        </main>
      </section>
    </div>
  );
};
