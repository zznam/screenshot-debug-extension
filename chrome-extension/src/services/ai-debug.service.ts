import { runtime, tabs } from 'webextension-polyfill';

import { AI_DEBUG, deepRedactSensitiveInfo } from '@extension/shared';
import type { AiDebugMessage, AiDebugResponse, AiDebugSession } from '@extension/shared';

import {
  deleteAiDebugSession,
  findAiDebugSession,
  getAiDebugSession,
  listAiDebugSessions,
  putAiDebugSession,
} from './ai-debug-indexed-db.service';
import { getRecords } from '../utils';

const DEFAULT_MODEL = 'gpt-5.6-terra';
const MAX_RECORDS = 200;
const MAX_RECORD_BYTES = 1024 * 1024;
const AI_PAGE_PATH = 'ai-debug/index.html';

const friendlyError = (code: string, message: string): AiDebugResponse => ({ status: 'error', code, message });

const isEligibleUrl = (url?: string) => Boolean(url && (url.startsWith('http://') || url.startsWith('https://')));

const getSourceId = async (tabId: number): Promise<string> => {
  try {
    const response = (await tabs.sendMessage(tabId, { action: AI_DEBUG.SOURCE_ID })) as { sourceId?: string };
    if (response?.sourceId) return response.sourceId;
  } catch {
    // A fallback still allows debugging when an old content runtime is loaded.
  }
  return `tab-${tabId}`;
};

const limitAiDebugRecords = (records: unknown[]): { records: unknown[]; truncated: boolean } => {
  const newest = [...records]
    .sort(
      (a, b) =>
        Number((b as { timestamp?: number }).timestamp ?? 0) - Number((a as { timestamp?: number }).timestamp ?? 0),
    )
    .slice(0, MAX_RECORDS);
  const selected: unknown[] = [];
  let bytes = 2;

  for (const record of newest) {
    const redacted = deepRedactSensitiveInfo(record, 'https://ai-debug-boundary.example');
    const serialized = JSON.stringify(redacted);
    const nextBytes = new TextEncoder().encode(serialized).byteLength + (selected.length ? 1 : 0);
    if (bytes + nextBytes > MAX_RECORD_BYTES) break;
    selected.push(redacted);
    bytes += nextBytes;
  }

  return { records: selected.reverse(), truncated: selected.length < records.length };
};

const openOrFocusAiPage = async (sessionId: string): Promise<void> => {
  const pageUrl = runtime.getURL(`${AI_PAGE_PATH}?session=${encodeURIComponent(sessionId)}`);
  const allTabs = await tabs.query({});
  const existing = allTabs.find(tab => tab.url === pageUrl);

  if (existing?.id) {
    await tabs.update(existing.id, { active: true });
    await tabs.reload(existing.id);
    if (existing.windowId) await chrome.windows.update(existing.windowId, { focused: true });
    return;
  }

  await tabs.create({ url: pageUrl, active: true });
};

const startAiDebug = async (tabId: number, preparedScreenshotDataUrl?: string): Promise<AiDebugResponse> => {
  let tab: Awaited<ReturnType<typeof tabs.get>>;
  try {
    tab = await tabs.get(tabId);
  } catch {
    return friendlyError('TAB_NOT_FOUND', 'The page is no longer open. Choose another tab and try again.');
  }

  if (!isEligibleUrl(tab.url)) {
    return friendlyError('RESTRICTED_URL', 'AI Debug works on regular HTTP or HTTPS pages.');
  }

  const sourceId = await getSourceId(tabId);
  const storedRecords = await getRecords(tabId);
  const limited = limitAiDebugRecords(storedRecords);
  let screenshotDataUrl: string | null = preparedScreenshotDataUrl ?? null;
  let captureError: string | undefined;

  if (!screenshotDataUrl) {
    try {
      screenshotDataUrl = await tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 80 });
    } catch {
      captureError = 'Could not capture the page. Return to the source tab and retry.';
    }
  }

  const now = Date.now();
  const existing = await findAiDebugSession(sourceId, tabId);
  const session: AiDebugSession = {
    id: existing?.id ?? crypto.randomUUID(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    model: existing?.model ?? DEFAULT_MODEL,
    status: screenshotDataUrl ? 'prepared' : 'error',
    context: {
      sourceTabId: tabId,
      sourceId,
      sourceUrl: tab.url ?? '',
      sourceTitle: tab.title || new URL(tab.url!).hostname,
      capturedAt: now,
      screenshotDataUrl,
      records: limited.records,
      recordsTruncated: limited.truncated,
    },
    messages: existing?.messages ?? [],
    ...(captureError ? { error: captureError } : {}),
  };

  await putAiDebugSession(session);
  await openOrFocusAiPage(session.id);
  return { status: 'success' };
};

const getAiDebug = async (sessionId: string): Promise<AiDebugResponse> => {
  const session = await getAiDebugSession(sessionId);
  return session
    ? { status: 'success', session }
    : friendlyError('SESSION_NOT_FOUND', 'This AI session no longer exists.');
};

const saveAiDebugMessage = async (
  sessionId: string,
  message: AiDebugMessage,
  model?: string,
): Promise<AiDebugResponse> => {
  const session = await getAiDebugSession(sessionId);
  if (!session) return friendlyError('SESSION_NOT_FOUND', 'This AI session no longer exists.');

  const messages = session.messages.some(item => item.id === message.id)
    ? session.messages
    : [...session.messages, message];
  const updated = {
    ...session,
    messages,
    model: model ?? session.model,
    status: message.role === 'assistant' ? ('ready' as const) : ('prepared' as const),
    updatedAt: Date.now(),
  };
  await putAiDebugSession(updated);
  return { status: 'success', session: updated };
};

const listAiDebug = async (): Promise<AiDebugResponse> => ({
  status: 'success',
  sessions: await listAiDebugSessions(),
});

const removeAiDebug = async (sessionId: string): Promise<AiDebugResponse> => {
  await deleteAiDebugSession(sessionId);
  return { status: 'success' };
};

export { getAiDebug, limitAiDebugRecords, listAiDebug, removeAiDebug, saveAiDebugMessage, startAiDebug };
